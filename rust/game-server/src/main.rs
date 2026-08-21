use std::{
    collections::HashMap,
    env,
    net::SocketAddr,
    sync::{Arc, Weak},
    time::Duration,
};

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
use tokio::sync::{Mutex, mpsc};
use tower_http::{
    cors::CorsLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    trace::TraceLayer,
};
use tracing::{info, warn};

#[derive(Clone)]
struct AppState {
    rooms: Arc<RoomRegistry>,
}

struct RoomRegistry {
    rooms: Mutex<HashMap<String, RoomHandle>>,
    config: RoomConfig,
}

#[derive(Clone, Copy)]
struct RoomConfig {
    size: usize,
    day_duration: Duration,
    night_duration: Duration,
}

#[derive(Clone)]
struct RoomHandle {
    token: uuid::Uuid,
    commands: mpsc::Sender<RoomCommand>,
}

struct RoomPeer {
    sender: mpsc::Sender<String>,
    joined: bool,
}

enum RoomCommand {
    Connect {
        socket_id: String,
        sender: mpsc::Sender<String>,
    },
    Join {
        socket_id: String,
        callback_id: Option<String>,
    },
    Action {
        socket_id: String,
        envelope: ClientEventEnvelope,
    },
    AdvancePhase,
    Disconnect {
        socket_id: String,
    },
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
async fn main() -> Result<(), Box<dyn std::error::Error>> {
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
        rooms: Arc::new(RoomRegistry {
            rooms: Mutex::new(HashMap::new()),
            config: RoomConfig {
                size: room_size,
                day_duration: duration_from_env("DAY_SECONDS", 60),
                night_duration: duration_from_env("NIGHT_SECONDS", 45),
            },
        }),
    };
    let app = app(state);
    let address = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(address).await?;
    info!(%address, "game server listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown())
        .await?;
    Ok(())
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
    let room = state.rooms.get_or_create(room_id.clone()).await;
    let (mut sender, mut incoming) = socket.split();
    let (direct_sender, mut direct_receiver) = mpsc::channel::<String>(256);
    let _ = room
        .commands
        .send(RoomCommand::Connect {
            socket_id: socket_id.clone(),
            sender: direct_sender.clone(),
        })
        .await;
    let outbound = tokio::spawn(async move {
        while let Some(payload) = direct_receiver.recv().await {
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
            let callback_id = envelope.callback_id;
            let _ = room
                .commands
                .send(RoomCommand::Join {
                    socket_id: socket_id.clone(),
                    callback_id,
                })
                .await;
            continue;
        }

        let _ = room
            .commands
            .send(RoomCommand::Action {
                socket_id: socket_id.clone(),
                envelope,
            })
            .await;
    }
    outbound.abort();
    let _ = room
        .commands
        .send(RoomCommand::Disconnect { socket_id })
        .await;
}

impl RoomRegistry {
    async fn get_or_create(self: &Arc<Self>, room_id: String) -> RoomHandle {
        let mut rooms = self.rooms.lock().await;
        if let Some(handle) = rooms.get(&room_id) {
            return handle.clone();
        }

        let (commands, receiver) = mpsc::channel(256);
        let handle = RoomHandle {
            token: uuid::Uuid::new_v4(),
            commands,
        };
        rooms.insert(room_id.clone(), handle.clone());
        tokio::spawn(run_room_actor(
            Arc::downgrade(self),
            room_id,
            handle.token,
            receiver,
            handle.commands.clone(),
            self.config,
        ));
        handle
    }

    async fn remove_if_current(&self, room_id: &str, token: uuid::Uuid) {
        let mut rooms = self.rooms.lock().await;
        if rooms
            .get(room_id)
            .is_some_and(|handle| handle.token == token)
        {
            rooms.remove(room_id);
        }
    }
}

async fn run_room_actor(
    registry: Weak<RoomRegistry>,
    room_id: String,
    token: uuid::Uuid,
    mut commands: mpsc::Receiver<RoomCommand>,
    actor_sender: mpsc::Sender<RoomCommand>,
    config: RoomConfig,
) {
    let mut actor = RoomActor {
        room: Room::new(config.size, room_id.clone()),
        peers: HashMap::new(),
        scheduler_started: false,
        day_duration: config.day_duration,
        night_duration: config.night_duration,
    };

    while let Some(command) = commands.recv().await {
        match command {
            RoomCommand::Connect { socket_id, sender } => {
                actor.peers.insert(
                    socket_id,
                    RoomPeer {
                        sender,
                        joined: false,
                    },
                );
            }
            RoomCommand::Join {
                socket_id,
                callback_id,
            } => {
                actor.join(socket_id, callback_id, &actor_sender).await;
            }
            RoomCommand::Action {
                socket_id,
                envelope,
            } => {
                actor.action(&socket_id, envelope);
            }
            RoomCommand::AdvancePhase => actor.advance_phase(&actor_sender),
            RoomCommand::Disconnect { socket_id } => actor.disconnect(&socket_id),
        }
        if actor.peers.is_empty() {
            break;
        }
    }

    if let Some(registry) = registry.upgrade() {
        registry.remove_if_current(&room_id, token).await;
    }
}

struct RoomActor {
    room: Room,
    peers: HashMap<String, RoomPeer>,
    scheduler_started: bool,
    day_duration: Duration,
    night_duration: Duration,
}

impl RoomActor {
    async fn join(
        &mut self,
        socket_id: String,
        callback_id: Option<String>,
        actor_sender: &mpsc::Sender<RoomCommand>,
    ) {
        if !self.peers.contains_key(&socket_id) {
            return;
        }
        let result = self.room.add_user(socket_id.clone());
        if matches!(result, game_core::protocol::JoinRoomResult::Joined { .. })
            && let Some(peer) = self.peers.get_mut(&socket_id)
        {
            peer.joined = true;
        }
        if self.room.started && !self.scheduler_started {
            self.scheduler_started = true;
            self.start_phase_clock(actor_sender);
        }
        self.deliver_emissions();
        if let Some(callback_id) = callback_id {
            let callback = CallbackEnvelope {
                message_type: PartyKitMessageType::Callback,
                callback_id,
                args: vec![json!(result)],
            };
            if let Ok(payload) = serde_json::to_string(&callback) {
                self.send_to_peer(&socket_id, payload);
            }
        }
    }

    fn action(&mut self, socket_id: &str, envelope: ClientEventEnvelope) {
        match envelope.event {
            ClientEvent::Disconnect => self.room.remove_player(socket_id),
            ClientEvent::MessageSentByUser => {
                if let (Some(message), Some(phase)) =
                    (string_arg(&envelope, 0), phase_arg(&envelope, 1))
                {
                    self.room.handle_message(socket_id, message, phase);
                }
            }
            ClientEvent::HandleVote => {
                if let (Some(recipient), Some(phase)) =
                    (index_arg(&envelope, 0), phase_arg(&envelope, 1))
                {
                    self.room.handle_vote(socket_id, recipient, phase);
                }
            }
            ClientEvent::HandleWhisper => {
                if let (Some(recipient), Some(message), Some(phase)) = (
                    index_arg(&envelope, 0),
                    string_arg(&envelope, 1),
                    phase_arg(&envelope, 2),
                ) {
                    self.room
                        .handle_whisper(socket_id, recipient, message, phase);
                }
            }
            ClientEvent::HandleVisit => {
                if let Some(phase) = phase_arg(&envelope, 1) {
                    let recipient = envelope
                        .args
                        .first()
                        .and_then(|value| value.as_u64())
                        .and_then(|value| usize::try_from(value).ok());
                    self.room.handle_visit(socket_id, recipient, phase);
                }
            }
            ClientEvent::PlayerJoinRoom => {}
        }
        self.deliver_emissions();
    }

    fn advance_phase(&mut self, actor_sender: &mpsc::Sender<RoomCommand>) {
        match self.room.time {
            RoomPhase::Day => self.room.finish_day(),
            RoomPhase::Night => self.room.finish_night(),
            RoomPhase::Idle => return,
        }
        self.deliver_emissions();
        if self.room.game_has_ended {
            self.scheduler_started = false;
        } else {
            self.start_phase_clock(actor_sender);
        }
    }

    fn disconnect(&mut self, socket_id: &str) {
        self.room.remove_player(socket_id);
        self.peers.remove(socket_id);
        self.deliver_emissions();
    }

    fn start_phase_clock(&self, actor_sender: &mpsc::Sender<RoomCommand>) {
        let duration = match self.room.time {
            RoomPhase::Day => self.day_duration,
            RoomPhase::Night => self.night_duration,
            RoomPhase::Idle => return,
        };
        let sender = actor_sender.clone();
        tokio::spawn(async move {
            tokio::time::sleep(duration).await;
            let _ = sender.send(RoomCommand::AdvancePhase).await;
        });
    }

    fn send_to_peer(&self, socket_id: &str, payload: String) {
        if let Some(peer) = self.peers.get(socket_id)
            && let Err(error) = peer.sender.try_send(payload)
        {
            warn!(%error, %socket_id, "failed to queue room message");
        }
    }

    fn deliver_emissions(&mut self) {
        for emission in self.room.drain_emissions() {
            let payload =
                json!({ "type": "event", "event": emission.event, "args": emission.args })
                    .to_string();
            if self.peers.contains_key(&emission.target) {
                self.send_to_peer(&emission.target, payload);
            } else {
                for peer in self.peers.values() {
                    if peer.joined
                        && let Err(error) = peer.sender.try_send(payload.clone())
                    {
                        warn!(%error, "failed to queue room broadcast");
                    }
                }
            }
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
        if let Err(error) = tokio::signal::ctrl_c().await {
            warn!(%error, "install Ctrl+C handler failed");
        }
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut signal) =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            signal.recv().await;
        } else {
            warn!("install SIGTERM handler failed");
        }
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
            rooms: Arc::new(RoomRegistry {
                rooms: Mutex::new(HashMap::new()),
                config: RoomConfig {
                    size: 4,
                    day_duration: Duration::from_secs(60),
                    night_duration: Duration::from_secs(45),
                },
            }),
        }
    }

    #[tokio::test]
    async fn health_endpoint_is_ready() -> Result<(), Box<dyn std::error::Error>> {
        let request = Request::builder().uri("/healthz").body(Body::empty())?;
        let response = app(test_state()).oneshot(request).await?;
        assert_eq!(response.status(), StatusCode::OK);
        Ok(())
    }

    #[tokio::test]
    async fn unknown_routes_return_not_found() -> Result<(), Box<dyn std::error::Error>> {
        let request = Request::builder().uri("/missing").body(Body::empty())?;
        let response = app(test_state()).oneshot(request).await?;
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        Ok(())
    }

    #[tokio::test]
    async fn invalid_websocket_room_names_are_rejected_before_upgrade()
    -> Result<(), Box<dyn std::error::Error>> {
        for room in [
            "bad%20room",
            "..",
            "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklm",
        ] {
            let request = Request::builder()
                .uri(format!("/ws/{room}"))
                .body(Body::empty())?;
            let response = app(test_state()).oneshot(request).await?;
            assert_eq!(response.status(), StatusCode::BAD_REQUEST, "room={room}");
        }
        Ok(())
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

    #[tokio::test]
    async fn room_actor_serializes_delivery_on_one_peer_queue()
    -> Result<(), Box<dyn std::error::Error>> {
        let (sender, mut receiver) = mpsc::channel(16);
        let mut actor = RoomActor {
            room: Room::new(2, "delivery-room"),
            peers: HashMap::from([(
                "socket-a".to_string(),
                RoomPeer {
                    sender,
                    joined: true,
                },
            )]),
            scheduler_started: false,
            day_duration: Duration::from_secs(60),
            night_duration: Duration::from_secs(45),
        };
        actor.room.add_user("socket-a");
        actor.deliver_emissions();
        let payload = receiver.recv().await.ok_or("missing room event")?;
        assert!(payload.contains("receiveMessage") || payload.contains("receive-new-player"));
        Ok(())
    }

    #[tokio::test]
    async fn registry_creates_independent_room_actors() {
        let registry = Arc::new(RoomRegistry {
            rooms: Mutex::new(HashMap::new()),
            config: RoomConfig {
                size: 4,
                day_duration: Duration::from_secs(60),
                night_duration: Duration::from_secs(45),
            },
        });
        let first = registry.get_or_create("room-a".into()).await;
        let second = registry.get_or_create("room-b".into()).await;
        assert_ne!(first.token, second.token);
        assert_eq!(registry.rooms.lock().await.len(), 2);
        drop(first);
        drop(second);
    }
}
