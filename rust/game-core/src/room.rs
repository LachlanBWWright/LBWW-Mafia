use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::protocol::{JoinRoomResult, JoinRoomResultCode, ServerEvent};

const DEFAULT_NAMES: [&str; 20] = [
    "Glen", "Finn", "Alex", "Joey", "Noel", "Jade", "Nico", "Abby", "Liam", "Ivan",
    "Adam", "Ella", "Erin", "Jane", "Lily", "Ruth", "Rhys", "Todd", "Reid", "Mara",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RoomPhase {
    Idle,
    Day,
    Night,
}

impl Default for RoomPhase {
    fn default() -> Self {
        Self::Idle
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct User {
    pub socket_id: String,
    pub username: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Player {
    pub username: String,
    pub is_alive: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoomEmission {
    pub target: String,
    pub event: String,
    pub args: Vec<Value>,
    #[serde(rename = "messageKey", skip_serializing_if = "Option::is_none")]
    pub message_key: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum RoomAction {
    #[serde(rename = "addUser")]
    AddUser {
        #[serde(rename = "socketId")]
        socket_id: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Room {
    pub name: String,
    pub size: usize,
    pub user_list: Vec<User>,
    pub player_list: Vec<Player>,
    pub started: bool,
    pub time: RoomPhase,
    pub emissions: Vec<RoomEmission>,
}

impl Room {
    pub fn new(size: usize, name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            size,
            user_list: Vec::new(),
            player_list: Vec::new(),
            started: false,
            time: RoomPhase::Idle,
            emissions: Vec::new(),
        }
    }

    pub fn add_user(&mut self, socket_id: impl Into<String>) -> JoinRoomResult {
        let socket_id = socket_id.into();
        if self.user_list.iter().any(|user| user.socket_id == socket_id) {
            return JoinRoomResult::Rejected {
                code: JoinRoomResultCode::GenericError,
            };
        }

        if self.user_list.len() >= self.size {
            return JoinRoomResult::Rejected {
                code: JoinRoomResultCode::RoomFull,
            };
        }

        let username = self.next_username();
        let room_name = self.name.clone();
        let user = User {
            socket_id: socket_id.clone(),
            username: username.clone(),
        };
        self.user_list.push(user);

        self.emit_message(
            ServerEvent::ReceiveMessage,
            Some(&room_name),
            json!({ "key": "player_joined_room", "params": { "playerName": username } }),
        );
        self.emit_event(
            ServerEvent::ReceiveNewPlayer,
            Some(&room_name),
            json!({ "name": username }),
        );

        if self.user_list.len() == self.size {
            self.start_game();
        }

        JoinRoomResult::Joined { username }
    }

    pub fn start_game(&mut self) {
        if self.started {
            return;
        }

        let room_name = self.name.clone();
        self.started = true;
        self.time = RoomPhase::Day;
        self.player_list = self
            .user_list
            .iter()
            .map(|user| Player {
                username: user.username.clone(),
                is_alive: true,
            })
            .collect();

        self.emit_message(
            ServerEvent::ReceiveMessage,
            Some(&room_name),
            json!({ "key": "room_full_starting_game" }),
        );
    }

    pub fn apply_action(&mut self, action: &RoomAction) -> Option<JoinRoomResult> {
        match action {
            RoomAction::AddUser { socket_id } => Some(self.add_user(socket_id.clone())),
        }
    }

    pub fn user_names(&self) -> Vec<&str> {
        self.user_list.iter().map(|user| user.username.as_str()).collect()
    }

    pub fn player_count(&self) -> usize {
        self.player_list.len()
    }

    fn next_username(&self) -> String {
        for candidate in DEFAULT_NAMES {
            if !self.user_list.iter().any(|user| user.username == candidate) {
                return candidate.to_string();
            }
        }

        format!("Player{}", self.user_list.len() + 1)
    }

    fn emit_event(&mut self, event: ServerEvent, target: Option<&str>, payload: Value) {
        self.emissions.push(RoomEmission {
            target: target.unwrap_or(&self.name).to_string(),
            event: event.as_str().to_string(),
            args: vec![payload],
            message_key: None,
        });
    }

    fn emit_message(&mut self, event: ServerEvent, target: Option<&str>, payload: Value) {
        let message_key = payload
            .get("key")
            .and_then(Value::as_str)
            .map(str::to_string);
        self.emissions.push(RoomEmission {
            target: target.unwrap_or(&self.name).to_string(),
            event: event.as_str().to_string(),
            args: vec![payload],
            message_key,
        });
    }
}

impl ServerEvent {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ReceiveMessage => "receiveMessage",
            Self::BlockMessages => "blockMessages",
            Self::ReceiveNewPlayer => "receive-new-player",
            Self::RemovePlayer => "remove-player",
            Self::ReceivePlayerList => "receive-player-list",
            Self::ReceiveChatMessage => "receive-chat-message",
            Self::ReceiveWhisperMessage => "receive-whisper-message",
            Self::UpdateDayTime => "update-day-time",
            Self::DisableVoting => "disable-voting",
            Self::UpdatePlayerRole => "update-player-role",
            Self::AssignPlayerRole => "assign-player-role",
            Self::UpdateFactionRole => "update-faction-role",
            Self::ReceiveRole => "receive-role",
            Self::UpdatePlayerVisit => "update-player-visit",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoomReplayFixture {
    #[serde(rename = "roomSize")]
    pub room_size: usize,
    #[serde(rename = "roomName")]
    pub room_name: String,
    pub actions: Vec<RoomAction>,
    #[serde(rename = "expectedJoinResults")]
    pub expected_join_results: Vec<JoinRoomResult>,
    #[serde(rename = "expectedState")]
    pub expected_state: RoomFixtureState,
    #[serde(rename = "expectedEvents")]
    pub expected_events: Vec<RoomFixtureExpectedEvent>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoomFixtureState {
    pub started: bool,
    pub phase: RoomPhase,
    #[serde(rename = "userNames")]
    pub user_names: Vec<String>,
    #[serde(rename = "playerCount")]
    pub player_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoomFixtureExpectedEvent {
    pub target: String,
    pub event: String,
    #[serde(rename = "messageKey")]
    pub message_key: Option<String>,
}

pub fn load_room_fixture(path: &std::path::Path) -> RoomReplayFixture {
    let contents = std::fs::read_to_string(path).expect("fixture should be readable");
    serde_json::from_str(&contents).expect("fixture should deserialize")
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{load_room_fixture, Room};

    #[test]
    fn room_lifecycle_fixture_replays_against_rust_room() {
        let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../shared/gameplay-fixtures/room/lobby-lifecycle.json");
        let fixture = load_room_fixture(&fixture_path);

        let mut room = Room::new(fixture.room_size, fixture.room_name.clone());
        let join_results = fixture
            .actions
            .iter()
            .map(|action| room.apply_action(action).unwrap())
            .collect::<Vec<_>>();

        assert_eq!(join_results, fixture.expected_join_results);
        assert_eq!(room.started, fixture.expected_state.started);
        assert_eq!(room.time, fixture.expected_state.phase);
        assert_eq!(room.user_names(), fixture.expected_state.user_names.iter().map(String::as_str).collect::<Vec<_>>());
        assert_eq!(room.player_count(), fixture.expected_state.player_count);

        for expected_event in &fixture.expected_events {
            let matched = room.emissions.iter().any(|emission| {
                emission.target == expected_event.target
                    && emission.event == expected_event.event
                    && emission.message_key.as_deref() == expected_event.message_key.as_deref()
            });
            assert!(matched, "expected event {:?} not emitted", expected_event);
        }
    }
}
