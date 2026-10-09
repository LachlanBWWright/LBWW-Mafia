//! Deterministic helpers for simulating complete games without a transport.
//!
//! These helpers intentionally use the same public `Room` API as the server.
//! Tests can build a known role composition, apply protocol actions, advance
//! phases, and inspect the resulting event stream without constructing sockets.

use crate::{
    protocol::{DayTime, JoinRoomResult},
    roles::{MAFIA_ROLES, NEUTRAL_ROLES, RoleDefinition, TOWN_ROLES},
    room::{CombatLevel, Player, Room, RoomAction, RoomEmission},
};

#[derive(Debug, Clone, PartialEq)]
pub struct MockGame {
    pub room: Room,
    pub sockets: Vec<String>,
}

impl MockGame {
    /// Creates a room with connected players and deterministic role assignments.
    pub fn with_roles(room_name: impl Into<String>, role_names: &[&str]) -> Result<Self, String> {
        if role_names.is_empty() {
            return Err("a mock game needs at least one player".into());
        }

        let sockets = (0..role_names.len())
            .map(|index| format!("socket-{index}"))
            .collect::<Vec<_>>();
        let mut room = Room::new(role_names.len(), room_name);
        for socket in &sockets {
            room.add_user(socket.clone());
        }

        for (index, role_name) in role_names.iter().enumerate() {
            let role =
                find_role(role_name).ok_or_else(|| format!("unknown mock role: {role_name}"))?;
            let Some(player) = room.player_list.get_mut(index) else {
                return Err(format!("missing mock player at index {index}"));
            };
            reset_player(player, role);
        }
        room.drain_emissions();

        Ok(Self { room, sockets })
    }

    pub fn socket(&self, index: usize) -> String {
        self.sockets.get(index).cloned().unwrap_or_default()
    }

    pub fn apply(&mut self, action: RoomAction) -> Option<JoinRoomResult> {
        self.room.apply_action(&action)
    }

    pub fn replay<I>(&mut self, actions: I) -> Vec<JoinRoomResult>
    where
        I: IntoIterator<Item = RoomAction>,
    {
        actions
            .into_iter()
            .filter_map(|action| self.apply(action))
            .collect()
    }

    pub fn chat(&mut self, player: usize, message: &str, phase: DayTime) {
        let socket = self.socket(player);
        self.room.handle_message(&socket, message, phase);
    }

    pub fn vote(&mut self, player: usize, target: usize, phase: DayTime) {
        let socket = self.socket(player);
        self.room.handle_vote(&socket, target, phase);
    }

    pub fn visit(&mut self, player: usize, target: Option<usize>, phase: DayTime) {
        let socket = self.socket(player);
        self.room.handle_visit(&socket, target, phase);
    }

    pub fn whisper(&mut self, player: usize, target: usize, message: &str, phase: DayTime) {
        let socket = self.socket(player);
        self.room.handle_whisper(&socket, target, message, phase);
    }

    pub fn finish_day(&mut self) {
        self.room.finish_day();
    }

    pub fn finish_night(&mut self) {
        self.room.finish_night();
    }

    pub fn drain_events(&mut self) -> Vec<RoomEmission> {
        self.room.drain_emissions()
    }

    pub fn has_event(&self, event: &str) -> bool {
        self.room
            .emissions
            .iter()
            .any(|emission| emission.event == event)
    }

    pub fn has_message(&self, message_key: &str) -> bool {
        self.room
            .emissions
            .iter()
            .any(|emission| emission.message_key.as_deref() == Some(message_key))
    }

    pub fn player(&self, index: usize) -> Option<&Player> {
        self.room.player_list.get(index)
    }

    pub fn alive_indices(&self) -> Vec<usize> {
        self.room
            .player_list
            .iter()
            .enumerate()
            .filter_map(|(index, player)| player.is_alive.then_some(index))
            .collect()
    }

    pub fn alive_count(&self) -> usize {
        self.alive_indices().len()
    }

    pub fn role_index(&self, role_name: &str) -> Option<usize> {
        self.room
            .player_list
            .iter()
            .position(|player| player.role.name == role_name)
    }
}

fn find_role(name: &str) -> Option<RoleDefinition> {
    TOWN_ROLES
        .iter()
        .chain(MAFIA_ROLES)
        .chain(NEUTRAL_ROLES)
        .find(|role| role.name == name)
        .copied()
}

fn reset_player(player: &mut Player, role: RoleDefinition) {
    player.role = role;
    player.is_alive = true;
    player.has_voted = false;
    player.votes_received = 0;
    player.day_target = None;
    player.night_target = None;
    player.faction_vote_target = None;
    player.damage = CombatLevel::None;
    player.defence = role.base_defence;
    player.defence_bonus = CombatLevel::None;
    player.roleblocked = false;
    player.silenced = false;
    player.abandoned = false;
    player.visitors.clear();
    player.attackers.clear();
    player.persistent_target = None;
    player.charges = role.kind.starting_charges();
    player.insane = false;
    player.jailed_by = None;
    player.day_tapped_by = None;
    player.night_tapped_by = None;
    player.victory_condition = false;
}

#[cfg(test)]
mod tests {
    use super::MockGame;
    use crate::{protocol::DayTime, room::RoomAction};

    #[test]
    fn creates_deterministic_role_compositions() -> Result<(), Box<dyn std::error::Error>> {
        let game = MockGame::with_roles("mock-room", &["Mafia", "Doctor"])?;
        assert_eq!(game.socket(0), "socket-0");
        assert_eq!(game.player(0).map(|player| player.role.name), Some("Mafia"));
        assert_eq!(
            game.player(1).map(|player| player.role.name),
            Some("Doctor")
        );
        Ok(())
    }

    #[test]
    fn replays_protocol_actions_without_socket_setup() -> Result<(), Box<dyn std::error::Error>> {
        let mut game = MockGame::with_roles("mock-room", &["Mafia", "Doctor"])?;
        let results = game.replay([
            RoomAction::Message {
                socket_id: "socket-0".into(),
                message: "hello".into(),
                phase: DayTime::Day,
            },
            RoomAction::Vote {
                socket_id: "socket-1".into(),
                recipient: 0,
                phase: DayTime::Day,
            },
        ]);
        assert!(results.is_empty());
        assert!(game.has_event("receive-chat-message"));
        Ok(())
    }
}
