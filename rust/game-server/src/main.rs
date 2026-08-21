use std::{collections::HashMap, env, net::SocketAddr, sync::Arc, time::Duration};

use axum::{
    Json, Router,
    extract::{
        Path, State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    http::{HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
};
use futures_util::{SinkExt, StreamExt};
use game_core::{
    protocol::{CallbackEnvelope, ClientEvent, ClientEventEnvelope, DayTime, PartyKitMessageType},
    room::{Room, RoomPhase},
};
use serde::Deserialize;
use serde::Serialize;
use serde_json::json;
use tokio::sync::{Mutex, broadcast, mpsc};
use tower_http::{
    cors::CorsLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::TraceLayer,
};
use tracing::{info, warn};

#[derive(Clone)]
struct AppState {
    rooms: Arc<Mutex<HashMap<String, RoomState>>>,
    room_size: usize,
    day_duration: Duration,
    night_duration: Duration,
}

struct RoomState {
    room: Room,
    broadcasts: broadcast::Sender<String>,
    peers: HashMap<String, mpsc::Sender<String>>,
    scheduler_started: bool,
}

#[derive(Serialize)]
struct Health<'a> {
    status: &'a str,
    service: &'a str,
    version: &'a str,
}

#[derive(Deserialize)]
struct CaptchaResponse {
    success: bool,
}

#[tokio::main]
async fn main() {
    init_tracing();
    let port = env::var("PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(8000);
    let room_size = env::var("ROOM_SIZE")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(13);
    let state = AppState {
        rooms: Arc::new(Mutex::new(HashMap::new())),
        room_size,
        day_duration: duration_from_env("DAY_SECONDS", 60),
        night_duration: duration_from_env("NIGHT_SECONDS", 45),
    };
    let app = app(state);
    let address = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .expect("bind game server");
    info!(%address, "game server listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown())
        .await
        .expect("serve game server");
}

fn app(state: AppState) -> Router {
    let origins = env::var("ALLOWED_ORIGINS").unwrap_or_else(|_| "http://localhost:3000".into());
    let allowed: Vec<HeaderValue> = origins
        .split(',')
        .filter_map(|v| v.trim().parse().ok())
        .collect();
    let cors = CorsLayer::new()
        .allow_origin(allowed)
        .allow_methods([Method::GET])
        .allow_headers([]);
    Router::new()
        .route("/healthz", get(health))
        .route("/readyz", get(health))
        .route("/ws/{room_id}", get(websocket))
        .fallback(not_found)
        .with_state(state)
        .layer(PropagateRequestIdLayer::x_request_id())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
}

async fn health() -> Json<Health<'static>> {
    Json(Health {
        status: "ok",
        service: "mernmafia-game-server",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn not_found() -> Response {
    (StatusCode::NOT_FOUND, "not found").into_response()
}

async fn websocket(
    Path(room_id): Path<String>,
    State(state): State<AppState>,
    upgrade: WebSocketUpgrade,
) -> Response {
    if room_id.is_empty()
        || room_id.len() > 64
        || !room_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return (StatusCode::BAD_REQUEST, "invalid room id").into_response();
    }
    upgrade
        .max_message_size(16 * 1024)
        .on_upgrade(move |socket| session(socket, state, room_id))
}

async fn session(socket: WebSocket, state: AppState, room_id: String) {
    let socket_id = uuid::Uuid::new_v4().to_string();
    let receiver = {
        let mut rooms = state.rooms.lock().await;
        let entry = rooms.entry(room_id.clone()).or_insert_with(|| {
            let (broadcasts, _) = broadcast::channel(256);
            RoomState {
                room: Room::new(state.room_size, room_id.clone()),
                broadcasts,
                peers: HashMap::new(),
                scheduler_started: false,
            }
        });
        entry.broadcasts.subscribe()
    };
    let (mut sender, mut incoming) = socket.split();
    let mut receiver = receiver;
    let (direct_sender, mut direct_receiver) = mpsc::channel::<String>(32);
    {
        let mut rooms = state.rooms.lock().await;
        if let Some(room) = rooms.get_mut(&room_id) {
            room.peers.insert(socket_id.clone(), direct_sender.clone());
        }
    }
    let outbound = tokio::spawn(async move {
        loop {
            let payload = tokio::select! {
                received = receiver.recv() => match received { Ok(value) => value, Err(_) => break },
                received = direct_receiver.recv() => match received { Some(value) => value, None => break },
            };
            if sender.send(Message::Text(payload.into())).await.is_err() {
                return;
            }
        }
    });

    while let Some(Ok(message)) = incoming.next().await {
        let Message::Text(raw) = message else {
            continue;
        };
        let envelope: ClientEventEnvelope = match serde_json::from_str(&raw) {
            Ok(value) => value,
            Err(error) => {
                warn!(%error, %room_id, "invalid client envelope");
                continue;
            }
        };
        if let ClientEvent::PlayerJoinRoom = envelope.event {
            let captcha_token = envelope.args.first().and_then(|value| value.as_str());
            if !verify_captcha(captcha_token).await {
                if let Some(callback_id) = envelope.callback_id {
                    let callback = CallbackEnvelope {
                        message_type: PartyKitMessageType::Callback,
                        callback_id,
                        args: vec![json!({ "status": "rejected", "code": 2 })],
                    };
                    if let Ok(payload) = serde_json::to_string(&callback) {
                        let _ = direct_sender.send(payload).await;
                    }
                }
                continue;
            }
            let mut start_scheduler = false;
            let result = {
                let mut rooms = state.rooms.lock().await;
                let Some(room_state) = rooms.get_mut(&room_id) else {
                    continue;
                };
                let result = room_state.room.add_user(socket_id.clone());
                if room_state.room.started && !room_state.scheduler_started {
                    room_state.scheduler_started = true;
                    start_scheduler = true;
                }
                deliver_emissions(room_state);
                result
            };
            if let Some(callback_id) = envelope.callback_id {
                let callback = CallbackEnvelope {
                    message_type: PartyKitMessageType::Callback,
                    callback_id,
                    args: vec![json!(result)],
                };
                if let Ok(payload) = serde_json::to_string(&callback) {
                    let _ = direct_sender.send(payload).await;
                }
            }
            if start_scheduler {
                tokio::spawn(run_phase_clock(state.clone(), room_id.clone()));
            }
            continue;
        }

        let mut rooms = state.rooms.lock().await;
        let Some(room_state) = rooms.get_mut(&room_id) else {
            continue;
        };
        match envelope.event {
            ClientEvent::Disconnect => room_state.room.remove_player(&socket_id),
            ClientEvent::MessageSentByUser => {
                if let (Some(message), Some(phase)) =
                    (string_arg(&envelope, 0), phase_arg(&envelope, 1))
                {
                    room_state.room.handle_message(&socket_id, message, phase);
                }
            }
            ClientEvent::HandleVote => {
                if let (Some(recipient), Some(phase)) =
                    (index_arg(&envelope, 0), phase_arg(&envelope, 1))
                {
                    room_state.room.handle_vote(&socket_id, recipient, phase);
                }
            }
            ClientEvent::HandleWhisper => {
                if let (Some(recipient), Some(message), Some(phase)) = (
                    index_arg(&envelope, 0),
                    string_arg(&envelope, 1),
                    phase_arg(&envelope, 2),
                ) {
                    room_state
                        .room
                        .handle_whisper(&socket_id, recipient, message, phase);
                }
            }
            ClientEvent::HandleVisit => {
                if let Some(phase) = phase_arg(&envelope, 1) {
                    let recipient = envelope
                        .args
                        .first()
                        .and_then(|value| value.as_u64())
                        .and_then(|value| usize::try_from(value).ok());
                    room_state.room.handle_visit(&socket_id, recipient, phase);
                }
            }
            ClientEvent::PlayerJoinRoom => {}
        }
        deliver_emissions(room_state);
    }
    outbound.abort();
    let mut rooms = state.rooms.lock().await;
    if let Some(room_state) = rooms.get_mut(&room_id) {
        room_state.room.remove_player(&socket_id);
        room_state.peers.remove(&socket_id);
        deliver_emissions(room_state);
        if room_state.peers.is_empty() {
            rooms.remove(&room_id);
        }
    }
}

fn duration_from_env(name: &str, fallback: u64) -> Duration {
    Duration::from_secs(
        env::var(name)
            .ok()
            .and_then(|value| value.parse().ok())
            .filter(|seconds| *seconds > 0)
            .unwrap_or(fallback),
    )
}

async fn run_phase_clock(state: AppState, room_id: String) {
    loop {
        let duration = {
            let rooms = state.rooms.lock().await;
            let Some(room_state) = rooms.get(&room_id) else {
                return;
            };
            if room_state.room.game_has_ended {
                return;
            }
            match room_state.room.time {
                RoomPhase::Day => state.day_duration,
                RoomPhase::Night => state.night_duration,
                RoomPhase::Idle => return,
            }
        };
        tokio::time::sleep(duration).await;
        let mut rooms = state.rooms.lock().await;
        let Some(room_state) = rooms.get_mut(&room_id) else {
            return;
        };
        match room_state.room.time {
            RoomPhase::Day => room_state.room.finish_day(),
            RoomPhase::Night => room_state.room.finish_night(),
            RoomPhase::Idle => return,
        }
        deliver_emissions(room_state);
        if room_state.room.game_has_ended {
            room_state.scheduler_started = false;
            return;
        }
    }
}

fn string_arg(envelope: &ClientEventEnvelope, index: usize) -> Option<&str> {
    envelope
        .args
        .get(index)?
        .as_str()
        .filter(|value| !value.is_empty() && value.len() <= 150)
}

fn index_arg(envelope: &ClientEventEnvelope, index: usize) -> Option<usize> {
    usize::try_from(envelope.args.get(index)?.as_u64()?).ok()
}

fn phase_arg(envelope: &ClientEventEnvelope, index: usize) -> Option<DayTime> {
    serde_json::from_value(envelope.args.get(index)?.clone()).ok()
}

fn deliver_emissions(room_state: &mut RoomState) {
    for emission in room_state.room.drain_emissions() {
        let payload =
            json!({ "type": "event", "event": emission.event, "args": emission.args }).to_string();
        if let Some(peer) = room_state.peers.get(&emission.target) {
            let _ = peer.try_send(payload);
        } else {
            let _ = room_state.broadcasts.send(payload);
        }
    }
}

async fn verify_captcha(token: Option<&str>) -> bool {
    let Some(token) = token.filter(|value| !value.is_empty()) else {
        return false;
    };
    if env::var("DEBUG").is_ok_and(|value| value.eq_ignore_ascii_case("true")) {
        return true;
    }
    let Ok(secret) = env::var("CAPTCHA_KEY") else {
        return false;
    };
    let response = reqwest::Client::new()
        .post("https://www.google.com/recaptcha/api/siteverify")
        .form(&[("secret", secret.as_str()), ("response", token)])
        .send()
        .await;
    match response {
        Ok(response) => response
            .json::<CaptchaResponse>()
            .await
            .is_ok_and(|body| body.success),
        Err(error) => {
            warn!(%error, "captcha verification failed");
            false
        }
    }
}

fn init_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .json()
        .init();
}

async fn shutdown() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("install Ctrl+C handler")
    };
    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = terminate => {} }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;

    fn test_state() -> AppState {
        AppState {
            rooms: Arc::new(Mutex::new(HashMap::new())),
            room_size: 4,
            day_duration: Duration::from_secs(60),
            night_duration: Duration::from_secs(45),
        }
    }

    #[tokio::test]
    async fn health_endpoint_is_ready() {
        let response = app(test_state())
            .oneshot(
                Request::builder()
                    .uri("/healthz")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn unknown_routes_return_not_found() {
        let response = app(test_state())
            .oneshot(
                Request::builder()
                    .uri("/missing")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn invalid_websocket_room_names_are_rejected_before_upgrade() {
        for room in [
            "bad%20room",
            "..",
            "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklm",
        ] {
            let response = app(test_state())
                .oneshot(
                    Request::builder()
                        .uri(format!("/ws/{room}"))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::BAD_REQUEST, "room={room}");
        }
    }

    #[test]
    fn envelope_argument_helpers_validate_type_bounds_and_phase() {
        let envelope = ClientEventEnvelope {
            message_type: PartyKitMessageType::Event,
            event: ClientEvent::HandleWhisper,
            args: vec![json!(2), json!("hello"), json!("Day")],
            callback_id: None,
        };
        assert_eq!(index_arg(&envelope, 0), Some(2));
        assert_eq!(string_arg(&envelope, 1), Some("hello"));
        assert_eq!(phase_arg(&envelope, 2), Some(DayTime::Day));
        assert_eq!(index_arg(&envelope, 9), None);
        assert_eq!(string_arg(&envelope, 0), None);

        let invalid = ClientEventEnvelope {
            args: vec![json!(""), json!("x".repeat(151)), json!("Dusk")],
            ..envelope
        };
        assert_eq!(string_arg(&invalid, 0), None);
        assert_eq!(string_arg(&invalid, 1), None);
        assert_eq!(phase_arg(&invalid, 2), None);
    }

    #[tokio::test]
    async fn captcha_requires_a_token_even_in_debug_mode() {
        assert!(!verify_captcha(None).await);
        assert!(!verify_captcha(Some("")).await);
    }

    #[test]
    fn emission_delivery_targets_peers_and_broadcasts_room_events() {
        let mut room = Room::new(2, "delivery-room");
        room.add_user("socket-a");
        let (broadcasts, mut broadcast_receiver) = broadcast::channel(16);
        let (peer_sender, mut peer_receiver) = mpsc::channel(16);
        let mut state = RoomState {
            room,
            broadcasts,
            peers: HashMap::from([("socket-a".to_string(), peer_sender)]),
            scheduler_started: false,
        };
        deliver_emissions(&mut state);
        assert!(peer_receiver.try_recv().is_err());
        let payload = broadcast_receiver.try_recv().unwrap();
        assert!(payload.contains("receiveMessage") || payload.contains("receive-new-player"));
    }

    #[tokio::test(start_paused = true)]
    async fn phase_clock_advances_a_started_room() {
        let mut room = Room::new(2, "clock-room");
        room.add_user("a");
        room.add_user("b");
        room.drain_emissions();
        let (broadcasts, _) = broadcast::channel(16);
        let rooms = Arc::new(Mutex::new(HashMap::from([(
            "clock-room".to_string(),
            RoomState {
                room,
                broadcasts,
                peers: HashMap::new(),
                scheduler_started: true,
            },
        )])));
        let state = AppState {
            rooms: rooms.clone(),
            room_size: 2,
            day_duration: Duration::from_secs(60),
            night_duration: Duration::from_secs(45),
        };

        let clock = tokio::spawn(run_phase_clock(state, "clock-room".to_string()));
        tokio::task::yield_now().await;
        tokio::time::advance(Duration::from_secs(60)).await;
        tokio::task::yield_now().await;

        let room = rooms.lock().await;
        let state = &room["clock-room"].room;
        assert!(state.game_has_ended || state.time == RoomPhase::Night);
        clock.abort();
    }
}
