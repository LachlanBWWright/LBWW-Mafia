use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DayTime {
    #[serde(rename = "Day")]
    Day,
    #[serde(rename = "Night")]
    Night,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JoinRoomResultCode {
    GenericError = 1,
    CaptchaFailed = 2,
    RoomFull = 3,
}

impl Serialize for JoinRoomResultCode {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_u8(*self as u8)
    }
}

impl<'de> Deserialize<'de> for JoinRoomResultCode {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let code = u8::deserialize(deserializer)?;
        match code {
            1 => Ok(Self::GenericError),
            2 => Ok(Self::CaptchaFailed),
            3 => Ok(Self::RoomFull),
            other => Err(serde::de::Error::custom(format!(
                "unsupported join room result code: {other}"
            ))),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PartyKitMessageType {
    Event,
    Callback,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClientEvent {
    #[serde(rename = "playerJoinRoom")]
    PlayerJoinRoom,
    #[serde(rename = "disconnect")]
    Disconnect,
    #[serde(rename = "messageSentByUser")]
    MessageSentByUser,
    #[serde(rename = "handleVote")]
    HandleVote,
    #[serde(rename = "handleVisit")]
    HandleVisit,
    #[serde(rename = "handleWhisper")]
    HandleWhisper,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ServerEvent {
    #[serde(rename = "receiveMessage")]
    ReceiveMessage,
    #[serde(rename = "blockMessages")]
    BlockMessages,
    #[serde(rename = "receive-new-player")]
    ReceiveNewPlayer,
    #[serde(rename = "remove-player")]
    RemovePlayer,
    #[serde(rename = "receive-player-list")]
    ReceivePlayerList,
    #[serde(rename = "receive-chat-message")]
    ReceiveChatMessage,
    #[serde(rename = "receive-whisper-message")]
    ReceiveWhisperMessage,
    #[serde(rename = "update-day-time")]
    UpdateDayTime,
    #[serde(rename = "disable-voting")]
    DisableVoting,
    #[serde(rename = "update-player-role")]
    UpdatePlayerRole,
    #[serde(rename = "assign-player-role")]
    AssignPlayerRole,
    #[serde(rename = "update-faction-role")]
    UpdateFactionRole,
    #[serde(rename = "receive-role")]
    ReceiveRole,
    #[serde(rename = "update-player-visit")]
    UpdatePlayerVisit,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum JoinRoomResult {
    #[serde(rename = "joined")]
    Joined { username: String },
    #[serde(rename = "rejected")]
    Rejected { code: JoinRoomResultCode },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClientEventEnvelope {
    #[serde(rename = "type")]
    pub message_type: PartyKitMessageType,
    pub event: ClientEvent,
    pub args: Vec<Value>,
    #[serde(rename = "callbackId", skip_serializing_if = "Option::is_none")]
    pub callback_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SupabaseClientEnvelope {
    #[serde(rename = "roomId")]
    pub room_id: String,
    #[serde(rename = "socketId")]
    pub socket_id: String,
    pub message: ClientEventEnvelope,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ServerEventEnvelope {
    #[serde(rename = "type")]
    pub message_type: PartyKitMessageType,
    pub event: ServerEvent,
    pub args: Vec<Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CallbackEnvelope {
    #[serde(rename = "type")]
    pub message_type: PartyKitMessageType,
    #[serde(rename = "callbackId")]
    pub callback_id: String,
    pub args: Vec<Value>,
}
