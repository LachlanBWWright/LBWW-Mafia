use super::{Room, RoomAction};
use crate::protocol::JoinRoomResult;

/// Keeps transport command routing separate from the Room lifecycle and rules.
pub(crate) fn apply(room: &mut Room, action: &RoomAction) -> Option<JoinRoomResult> {
    match action {
        RoomAction::AddUser { socket_id } => Some(room.add_user(socket_id.clone())),
        RoomAction::RemovePlayer { socket_id } => {
            room.remove_player(socket_id);
            None
        }
        RoomAction::Message {
            socket_id,
            message,
            phase,
        } => {
            room.handle_message(socket_id, message, *phase);
            None
        }
        RoomAction::Vote {
            socket_id,
            recipient,
            phase,
        } => {
            room.handle_vote(socket_id, *recipient, *phase);
            None
        }
        RoomAction::Whisper {
            socket_id,
            recipient,
            message,
            phase,
        } => {
            room.handle_whisper(socket_id, *recipient, message, *phase);
            None
        }
        RoomAction::Visit {
            socket_id,
            recipient,
            phase,
        } => {
            room.handle_visit(socket_id, *recipient, *phase);
            None
        }
    }
}
