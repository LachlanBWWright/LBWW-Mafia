use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::{
    protocol::{DayTime, JoinRoomResult, JoinRoomResultCode, ServerEvent},
    roles::{RoleDefinition, assign_roles, shuffle_roles},
    systems::{
        DamageOutcome, Faction, VoteOutcome, determine_winner, resolve_damage, resolve_vote,
    },
};

const DEFAULT_NAMES: [&str; 20] = [
    "Glen", "Finn", "Alex", "Joey", "Noel", "Jade", "Nico", "Abby", "Liam", "Ivan", "Adam", "Ella",
    "Erin", "Jane", "Lily", "Ruth", "Rhys", "Todd", "Reid", "Mara",
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

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Player {
    pub socket_id: String,
    pub username: String,
    pub is_alive: bool,
    pub has_voted: bool,
    pub votes_received: usize,
    pub day_target: Option<usize>,
    pub night_target: Option<usize>,
    pub faction_vote_target: Option<usize>,
    pub damage: CombatLevel,
    pub defence: CombatLevel,
    pub defence_bonus: CombatLevel,
    pub role: RoleDefinition,
    pub roleblocked: bool,
    pub silenced: bool,
    pub abandoned: bool,
    pub visitors: Vec<usize>,
    pub attackers: Vec<usize>,
    pub persistent_target: Option<usize>,
    pub charges: u8,
    pub insane: bool,
    pub jailed_by: Option<usize>,
    pub day_tapped_by: Option<usize>,
    pub night_tapped_by: Option<usize>,
    pub victory_condition: bool,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[repr(u16)]
pub enum CombatLevel {
    #[default]
    None = 0,
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 99,
    Fatal = 999,
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
    #[serde(rename = "removePlayer")]
    RemovePlayer {
        #[serde(rename = "socketId")]
        socket_id: String,
    },
    #[serde(rename = "message")]
    Message {
        #[serde(rename = "socketId")]
        socket_id: String,
        message: String,
        phase: DayTime,
    },
    #[serde(rename = "vote")]
    Vote {
        #[serde(rename = "socketId")]
        socket_id: String,
        recipient: usize,
        phase: DayTime,
    },
    #[serde(rename = "whisper")]
    Whisper {
        #[serde(rename = "socketId")]
        socket_id: String,
        recipient: usize,
        message: String,
        phase: DayTime,
    },
    #[serde(rename = "visit")]
    Visit {
        #[serde(rename = "socketId")]
        socket_id: String,
        recipient: Option<usize>,
        phase: DayTime,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Room {
    pub name: String,
    pub size: usize,
    pub user_list: Vec<User>,
    pub player_list: Vec<Player>,
    pub started: bool,
    pub time: RoomPhase,
    pub emissions: Vec<RoomEmission>,
    pub day_number: usize,
    pub game_has_ended: bool,
    pub no_death_end_day: usize,
    pub voting_disabled: bool,
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
            day_number: 0,
            game_has_ended: false,
            no_death_end_day: 3,
            voting_disabled: false,
        }
    }

    pub fn add_user(&mut self, socket_id: impl Into<String>) -> JoinRoomResult {
        let socket_id = socket_id.into();
        if self
            .user_list
            .iter()
            .any(|user| user.socket_id == socket_id)
        {
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
        let mut roles = assign_roles(self.user_list.len(), rand::random::<f64>);
        shuffle_roles(&mut roles, rand::random::<f64>);
        self.player_list = self
            .user_list
            .iter()
            .zip(roles)
            .map(|(user, role)| Player {
                socket_id: user.socket_id.clone(),
                username: user.username.clone(),
                is_alive: true,
                has_voted: false,
                votes_received: 0,
                day_target: None,
                night_target: None,
                faction_vote_target: None,
                damage: CombatLevel::None,
                defence: role.base_defence,
                defence_bonus: CombatLevel::None,
                role,
                roleblocked: false,
                silenced: false,
                abandoned: false,
                visitors: Vec::new(),
                attackers: Vec::new(),
                persistent_target: None,
                charges: match role.name {
                    "Nimby" | "Vetter" => 3,
                    _ => 0,
                },
                insane: false,
                jailed_by: None,
                day_tapped_by: None,
                night_tapped_by: None,
                victory_condition: false,
            })
            .collect();
        self.refresh_framer_targets();

        self.emit_message(
            ServerEvent::ReceiveMessage,
            Some(&room_name),
            json!({ "key": "room_full_starting_game" }),
        );
        for player in self.player_list.clone() {
            self.emit_event(
                ServerEvent::AssignPlayerRole,
                Some(&player.socket_id),
                json!({
                    "name": player.username,
                    "role": player.role.name,
                    "dayVisitSelf": false,
                    "dayVisitOthers": player.role.name == "Tapper" || player.role.name == "Jailor",
                    "dayVisitFaction": false,
                    "nightVisitSelf": matches!(player.role.name, "Nimby" | "Vetter" | "Jailor"),
                    "nightVisitOthers": player.role.name != "Confesser" && player.role.name != "Blank Role",
                    "nightVisitFaction": false,
                    "nightVote": player.role.faction == Faction::Mafia,
                }),
            );
        }
        self.start_day(1);
    }

    pub fn start_day(&mut self, day_number: usize) {
        if self.game_has_ended {
            return;
        }
        if day_number >= self.no_death_end_day {
            for player in &mut self.player_list {
                if player.role.name == "Peacemaker" {
                    player.victory_condition = true;
                }
            }
            let room = self.name.clone();
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(&room),
                json!({"key":"game_ended_nobody_died"}),
            );
            self.game_has_ended = true;
            self.emit_no_args(ServerEvent::BlockMessages, Some(&room));
            return;
        }
        self.time = RoomPhase::Day;
        self.day_number = day_number;
        self.refresh_framer_targets();
        for player in &mut self.player_list {
            player.has_voted = false;
            player.votes_received = 0;
            player.day_target = None;
            player.silenced = false;
        }
        let room = self.name.clone();
        self.emit_event(
            ServerEvent::UpdateDayTime,
            Some(&room),
            json!({ "time": "Day", "dayNumber": day_number, "timeLeft": 60 }),
        );
        self.emit_message(
            ServerEvent::ReceiveMessage,
            Some(&room),
            if day_number == 1 {
                json!({ "key": "day_1_started" })
            } else {
                json!({ "key": "day_n_started", "params": { "dayNumber": day_number } })
            },
        );
    }

    pub fn finish_day(&mut self) {
        if self.game_has_ended || self.time != RoomPhase::Day {
            return;
        }
        self.resolve_day_actions();
        let living = self
            .player_list
            .iter()
            .filter(|player| player.is_alive)
            .count();
        let required = living / 2 + 1;
        let votes = self
            .player_list
            .iter()
            .map(|player| (player.votes_received, player.is_alive))
            .collect::<Vec<_>>();
        if let VoteOutcome::Eliminated { player, .. } = resolve_vote(&votes, required) {
            let voted_socket = self.player_list[player].socket_id.clone();
            for role in &mut self.player_list {
                if role.role.name == "Framer" && role.persistent_target == Some(player) {
                    role.victory_condition = true;
                }
                if role.role.name == "Confesser" && role.socket_id == voted_socket {
                    role.victory_condition = true;
                    self.voting_disabled = true;
                }
            }
            self.kill_player(player, "you_have_been_voted_out");
            if self.voting_disabled {
                let room = self.name.clone();
                self.emit_no_args(ServerEvent::DisableVoting, Some(&room));
            }
        }
        if self.finish_if_winner() {
            return;
        }
        self.start_night();
    }

    pub fn start_night(&mut self) {
        if self.game_has_ended {
            return;
        }
        self.time = RoomPhase::Night;
        for player in &mut self.player_list {
            player.has_voted = false;
            player.night_target = None;
            player.faction_vote_target = None;
            player.damage = if player.abandoned {
                CombatLevel::Fatal
            } else {
                CombatLevel::None
            };
            player.defence = max_combat(player.role.base_defence, player.defence_bonus);
            player.roleblocked = false;
            player.visitors.clear();
            player.attackers.clear();
        }
        let room = self.name.clone();
        self.emit_event(
            ServerEvent::UpdateDayTime,
            Some(&room),
            json!({ "time": "Night", "dayNumber": self.day_number, "timeLeft": 45 }),
        );
        self.emit_message(
            ServerEvent::ReceiveMessage,
            Some(&room),
            json!({ "key": "night_n_started", "params": { "dayNumber": self.day_number } }),
        );
    }

    pub fn finish_night(&mut self) {
        if self.game_has_ended || self.time != RoomPhase::Night {
            return;
        }
        self.resolve_night_actions();
        for index in 0..self.player_list.len() {
            if !self.player_list[index].is_alive {
                continue;
            }
            let outcome = {
                let player = &self.player_list[index];
                resolve_damage(player.damage, player.defence, player.role.base_defence)
            };
            match outcome {
                DamageOutcome::Died => self.kill_player(index, "you_have_died"),
                DamageOutcome::Survived => {
                    let socket = self.player_list[index].socket_id.clone();
                    self.emit_message(
                        ServerEvent::ReceiveMessage,
                        Some(&socket),
                        json!({ "key": "attacked_but_survived" }),
                    );
                }
                DamageOutcome::NoDamage => {}
            }
        }
        for player in &mut self.player_list {
            player.jailed_by = None;
        }
        if !self.finish_if_winner() {
            self.start_day(self.day_number + 1);
        }
    }

    fn resolve_night_actions(&mut self) {
        let mafia_votes = self
            .player_list
            .iter()
            .filter(|player| player.is_alive && player.role.faction == Faction::Mafia)
            .filter_map(|player| player.faction_vote_target)
            .fold(
                std::collections::HashMap::<usize, usize>::new(),
                |mut votes, target| {
                    *votes.entry(target).or_default() += 1;
                    votes
                },
            );
        if let Some((&target, _)) = mafia_votes
            .iter()
            .filter(|(target, _)| {
                **target < self.player_list.len() && self.player_list[**target].is_alive
            })
            .max_by_key(|(target, votes)| (**votes, std::cmp::Reverse(**target)))
        {
            self.player_list[target].damage =
                max_combat(self.player_list[target].damage, CombatLevel::Low);
            if let Some(attacker) = self
                .player_list
                .iter()
                .position(|player| player.is_alive && player.role.faction == Faction::Mafia)
            {
                self.player_list[target].attackers.push(attacker);
            }
        }
        let actions = self
            .player_list
            .iter()
            .enumerate()
            .filter_map(|(index, player)| {
                player
                    .is_alive
                    .then_some((index, player.night_target, player.role.name))
            })
            .collect::<Vec<_>>();
        for (actor, target, _role) in actions.iter().copied().filter(|(_, _, role)| {
            matches!(
                *role,
                "Roleblocker" | "Mafia Roleblocker" | "Peacemaker" | "Jailor"
            )
        }) {
            let Some(target) = target else { continue };
            if target < self.player_list.len()
                && self.player_list[target].is_alive
                && !self.player_list[actor].roleblocked
                && (_role == "Peacemaker"
                    || self.player_list[target].role.faction == Faction::Town
                    || rand::random::<f64>() > 0.5)
            {
                self.player_list[target].roleblocked = true;
                self.player_list[target].visitors.push(actor);
            }
        }
        for (actor, target, role) in actions.iter().copied().filter(|(_, _, role)| {
            !matches!(
                *role,
                "Roleblocker" | "Mafia Roleblocker" | "Peacemaker" | "Jailor"
            )
        }) {
            let Some(target) = target else { continue };
            if target >= self.player_list.len()
                || !self.player_list[target].is_alive
                || self.player_list[actor].roleblocked
            {
                continue;
            }
            if actor == target && !matches!(role, "Nimby" | "Vetter") {
                continue;
            }
            self.player_list[target].visitors.push(actor);
            match role {
                "Doctor" | "Bodyguard" => {
                    self.player_list[target].defence =
                        max_combat(self.player_list[target].defence, CombatLevel::Low)
                }
                "Sacrificer" => {}
                "Fortifier" => self.resolve_fortifier(actor, target),
                "Lawman" | "Maniac" => {
                    self.player_list[target].damage =
                        max_combat(self.player_list[target].damage, CombatLevel::Low);
                    self.player_list[target].attackers.push(actor);
                    if role == "Lawman" && self.player_list[target].role.faction == Faction::Town {
                        self.player_list[actor].insane = true;
                    }
                }
                "Investigator" => self.emit_investigation(actor, target, false),
                "Mafia Investigator" => self.emit_investigation(actor, target, true),
                "Judge" => self.emit_judgement(actor, target),
                "Nimby" if self.player_list[actor].charges > 0 => {
                    self.player_list[actor].charges -= 1;
                    self.player_list[actor].defence =
                        max_combat(self.player_list[actor].defence, CombatLevel::Low);
                }
                "Vetter" if self.player_list[actor].charges > 0 => {
                    self.player_list[actor].charges -= 1;
                    self.emit_vetter_result(actor);
                }
                _ => {}
            }
        }
        self.resolve_visit_outcomes(&actions);
    }

    fn resolve_day_actions(&mut self) {
        let actions = self
            .player_list
            .iter()
            .enumerate()
            .filter_map(|(actor, player)| {
                player
                    .is_alive
                    .then_some((actor, player.day_target, player.role.name))
            })
            .collect::<Vec<_>>();
        for (actor, target, role) in actions {
            let Some(target) = target else { continue };
            if actor == target
                || target >= self.player_list.len()
                || !self.player_list[target].is_alive
            {
                continue;
            }
            match role {
                "Jailor" => {
                    self.player_list[actor].persistent_target = Some(target);
                    self.player_list[target].jailed_by = Some(actor);
                    self.player_list[target].roleblocked = true;
                }
                "Tapper" => self.player_list[target].night_tapped_by = Some(actor),
                _ => {}
            }
        }
    }

    fn resolve_fortifier(&mut self, actor: usize, target: usize) {
        match self.player_list[actor].persistent_target {
            None => {
                self.player_list[actor].persistent_target = Some(target);
                self.player_list[target].defence_bonus = CombatLevel::Medium;
                self.player_list[target].defence =
                    max_combat(self.player_list[target].defence, CombatLevel::Medium);
            }
            Some(previous) if previous == target => {
                self.player_list[actor].persistent_target = None;
                self.player_list[target].defence_bonus = CombatLevel::None;
                if rand::random::<f64>() > 0.5 {
                    self.player_list[actor].damage = CombatLevel::Fatal;
                } else {
                    self.player_list[target].damage = CombatLevel::Fatal;
                }
            }
            Some(_) => {}
        }
    }

    fn emit_investigation(&mut self, actor: usize, target: usize, exact: bool) {
        let socket = self.player_list[actor].socket_id.clone();
        let target_name = self.player_list[target].username.clone();
        let role_name = self.player_list[target].role.name;
        let key = if exact {
            "mafia_investigator_result"
        } else {
            "investigator_result"
        };
        self.emit_message(ServerEvent::ReceiveMessage, Some(&socket), if exact { json!({"key": key, "params": {"targetName": target_name, "roleName": role_name}}) } else { json!({"key": key, "params": {"targetName": target_name, "role1": role_name, "role2": role_name, "role3": role_name}}) });
    }

    fn emit_judgement(&mut self, actor: usize, target: usize) {
        let socket = self.player_list[actor].socket_id.clone();
        self.emit_message(ServerEvent::ReceiveMessage, Some(&socket), json!({"key":"judge_alignment_result", "params":{"targetName":self.player_list[target].username, "factionName":self.player_list[target].role.faction}}));
    }

    fn emit_vetter_result(&mut self, actor: usize) {
        let first = (actor + 1) % self.player_list.len();
        let second = (actor + 2) % self.player_list.len();
        let socket = self.player_list[actor].socket_id.clone();
        self.emit_message(ServerEvent::ReceiveMessage, Some(&socket), json!({"key":"vetter_research_result", "params":{"name1":self.player_list[first].username,"name2":self.player_list[second].username,"roleName":self.player_list[first].role.name}}));
    }

    fn resolve_visit_outcomes(&mut self, actions: &[(usize, Option<usize>, &str)]) {
        for (actor, target, role) in actions.iter().copied() {
            let Some(target) = target else { continue };
            if target >= self.player_list.len() || self.player_list[actor].roleblocked {
                continue;
            }
            match role {
                "Bodyguard" => {
                    for visitor in self.player_list[target].attackers.clone() {
                        if visitor != actor {
                            self.player_list[visitor].damage =
                                max_combat(self.player_list[visitor].damage, CombatLevel::Low);
                        }
                    }
                }
                "Sacrificer" if !self.player_list[target].attackers.is_empty() => {
                    self.player_list[target].defence = CombatLevel::High;
                    self.player_list[actor].damage = CombatLevel::Critical;
                }
                "Nimby" => {
                    for visitor in self.player_list[actor].visitors.clone() {
                        if visitor != actor {
                            self.player_list[visitor].damage =
                                max_combat(self.player_list[visitor].damage, CombatLevel::Low);
                        }
                    }
                }
                "Sniper" => {
                    let stationary = self.player_list[target].night_target.is_none()
                        || self.player_list[target].night_target == Some(target);
                    let repeated = self.player_list[actor].persistent_target == Some(target);
                    if stationary {
                        self.player_list[target].damage =
                            max_combat(self.player_list[target].damage, CombatLevel::High);
                    } else if repeated && self.player_list[target].damage == CombatLevel::None {
                        self.player_list[target].damage = CombatLevel::Low;
                    }
                    self.player_list[actor].persistent_target = Some(target);
                }
                "Tracker" => {
                    let socket = self.player_list[actor].socket_id.clone();
                    let visit = self.player_list[target]
                        .night_target
                        .map(|i| self.player_list[i].username.clone());
                    self.emit_message(
                        ServerEvent::ReceiveMessage,
                        Some(&socket),
                        match visit {
                            Some(name) => {
                                json!({"key":"tracker_target_visited","params":{"targetName":name}})
                            }
                            None => json!({"key":"tracker_target_did_not_visit"}),
                        },
                    );
                }
                "Watchman" => {
                    let names = self.player_list[target]
                        .visitors
                        .iter()
                        .filter(|i| **i != actor)
                        .map(|i| self.player_list[*i].username.clone())
                        .collect::<Vec<_>>();
                    let socket = self.player_list[actor].socket_id.clone();
                    self.emit_message(
                        ServerEvent::ReceiveMessage,
                        Some(&socket),
                        json!({"key":"watchman_visitor_list","params":{"list":names.join(", ")}}),
                    );
                }
                "Tapper" => self.player_list[target].day_tapped_by = Some(actor),
                "Jailor" => {
                    if self.player_list[actor].persistent_target == Some(target) {
                        self.player_list[target].damage =
                            max_combat(self.player_list[target].damage, CombatLevel::High);
                        self.player_list[target].attackers.push(actor);
                    }
                }
                _ => {}
            }
        }
    }

    fn kill_player(&mut self, index: usize, personal_message: &str) {
        if !self.player_list[index].is_alive {
            return;
        }
        self.player_list[index].is_alive = false;
        self.no_death_end_day = self.day_number + 3;
        let player = self.player_list[index].clone();
        self.emit_message(
            ServerEvent::ReceiveMessage,
            Some(&player.socket_id),
            json!({ "key": personal_message }),
        );
        self.emit_no_args(ServerEvent::BlockMessages, Some(&player.socket_id));
        let room = self.name.clone();
        self.emit_message(ServerEvent::ReceiveMessage, Some(&room), json!({ "key": "player_has_died", "params": { "playerName": player.username, "roleName": player.role.name } }));
        self.emit_event(
            ServerEvent::UpdatePlayerRole,
            Some(&room),
            json!({ "name": player.username, "role": player.role.name }),
        );
    }

    fn finish_if_winner(&mut self) -> bool {
        let players = self
            .player_list
            .iter()
            .map(|player| (player.is_alive, player.role.faction))
            .collect::<Vec<_>>();
        let Some(winner) = determine_winner(&players) else {
            return false;
        };
        self.game_has_ended = true;
        let room = self.name.clone();
        let payload = if winner == Faction::Neutral
            || self
                .player_list
                .iter()
                .any(|player| player.victory_condition)
        {
            json!({ "key": "neutral_players_won" })
        } else {
            json!({ "key": "faction_won", "params": { "factionName": winner } })
        };
        self.emit_message(ServerEvent::ReceiveMessage, Some(&room), payload);
        self.emit_message(
            ServerEvent::ReceiveMessage,
            Some(&room),
            json!({ "key": "closing_room" }),
        );
        self.emit_no_args(ServerEvent::BlockMessages, Some(&room));
        true
    }

    pub fn apply_action(&mut self, action: &RoomAction) -> Option<JoinRoomResult> {
        match action {
            RoomAction::AddUser { socket_id } => Some(self.add_user(socket_id.clone())),
            RoomAction::RemovePlayer { socket_id } => {
                self.remove_player(socket_id);
                None
            }
            RoomAction::Message {
                socket_id,
                message,
                phase,
            } => {
                self.handle_message(socket_id, message, *phase);
                None
            }
            RoomAction::Vote {
                socket_id,
                recipient,
                phase,
            } => {
                self.handle_vote(socket_id, *recipient, *phase);
                None
            }
            RoomAction::Whisper {
                socket_id,
                recipient,
                message,
                phase,
            } => {
                self.handle_whisper(socket_id, *recipient, message, *phase);
                None
            }
            RoomAction::Visit {
                socket_id,
                recipient,
                phase,
            } => {
                self.handle_visit(socket_id, *recipient, *phase);
                None
            }
        }
    }

    pub fn remove_player(&mut self, socket_id: &str) {
        if !self.started {
            let Some(index) = self
                .user_list
                .iter()
                .position(|user| user.socket_id == socket_id)
            else {
                return;
            };
            let user = self.user_list.remove(index);
            let room = self.name.clone();
            self.emit_event(
                ServerEvent::RemovePlayer,
                Some(&room),
                json!({ "name": user.username }),
            );
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(&room),
                json!({ "key": "player_left_room", "params": { "playerName": user.username } }),
            );
            return;
        }
        let Some(player) = self
            .player_list
            .iter_mut()
            .find(|player| player.socket_id == socket_id)
        else {
            return;
        };
        player.damage = CombatLevel::Fatal;
        player.abandoned = true;
        let username = player.username.clone();
        let room = self.name.clone();
        self.emit_message(
            ServerEvent::ReceiveMessage,
            Some(&room),
            json!({ "key": "player_abandoned_game", "params": { "playerName": username } }),
        );
    }

    pub fn handle_message(&mut self, socket_id: &str, message: &str, phase: DayTime) {
        let Some(user) = self
            .user_list
            .iter()
            .find(|user| user.socket_id == socket_id)
        else {
            return;
        };
        let username = user.username.clone();
        if !self.started {
            let room = self.name.clone();
            self.emit_event(
                ServerEvent::ReceiveChatMessage,
                Some(&room),
                json!(format!("{username}: {message}")),
            );
            return;
        }
        if !self.phase_matches(phase) {
            return;
        }
        let Some(player) = self
            .player_list
            .iter()
            .find(|player| player.socket_id == socket_id)
        else {
            return;
        };
        if !player.is_alive {
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(socket_id),
                json!({ "key": "cannot_speak_you_are_dead" }),
            );
            return;
        }
        if self.time == RoomPhase::Night {
            if let Some(jailor) = player.jailed_by.or_else(|| {
                (player.role.name == "Jailor")
                    .then_some(player)
                    .and_then(|_| {
                        self.player_list
                            .iter()
                            .position(|p| p.socket_id == socket_id)
                    })
                    .and_then(|i| self.player_list[i].persistent_target)
            }) {
                let target_socket = self.player_list[jailor].socket_id.clone();
                self.emit_event(
                    ServerEvent::ReceiveChatMessage,
                    Some(&target_socket),
                    json!(format!("Jail: {message}")),
                );
                return;
            }
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(socket_id),
                json!({ "key": "cannot_speak_at_night" }),
            );
            return;
        }
        let room = self.name.clone();
        self.emit_event(
            ServerEvent::ReceiveChatMessage,
            Some(&room),
            json!(format!("{username}: {message}")),
        );
    }

    pub fn handle_vote(&mut self, socket_id: &str, recipient: usize, phase: DayTime) {
        if !self.started || !self.phase_matches(phase) {
            return;
        }
        let Some(voter_index) = self
            .player_list
            .iter()
            .position(|player| player.socket_id == socket_id)
        else {
            return;
        };
        if recipient >= self.player_list.len() {
            return;
        }
        if self.time == RoomPhase::Day && self.voting_disabled {
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(socket_id),
                json!({"key":"voting_disabled_confeser"}),
            );
            return;
        }
        if self.time == RoomPhase::Night {
            if self.player_list[voter_index].is_alive
                && self.player_list[voter_index].role.faction == Faction::Mafia
                && self.player_list[recipient].is_alive
                && self.player_list[recipient].role.faction != Faction::Mafia
            {
                self.player_list[voter_index].faction_vote_target = Some(recipient);
            }
            return;
        }
        if self.player_list[voter_index].has_voted {
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(socket_id),
                json!({ "key": "cannot_change_vote" }),
            );
            return;
        }
        if voter_index == recipient {
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(socket_id),
                json!({ "key": "cannot_vote_yourself" }),
            );
            return;
        }
        if !self.player_list[recipient].is_alive {
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(socket_id),
                json!({ "key": "vote_invalid" }),
            );
            return;
        }
        self.player_list[voter_index].has_voted = true;
        self.player_list[recipient].votes_received += 1;
        let voter = self.player_list[voter_index].username.clone();
        let target = self.player_list[recipient].username.clone();
        let count = self.player_list[recipient].votes_received;
        let room = self.name.clone();
        let payload = if count == 1 {
            json!({ "key": "vote_cast_single", "params": { "voterName": voter, "targetName": target } })
        } else {
            json!({ "key": "vote_cast_multiple", "params": { "voterName": voter, "targetName": target, "count": count } })
        };
        self.emit_message(ServerEvent::ReceiveMessage, Some(&room), payload);
    }

    pub fn handle_whisper(
        &mut self,
        socket_id: &str,
        recipient: usize,
        message: &str,
        phase: DayTime,
    ) {
        if !self.started || !self.phase_matches(phase) {
            return;
        }
        let Some(sender_index) = self
            .player_list
            .iter()
            .position(|player| player.socket_id == socket_id)
        else {
            return;
        };
        if recipient >= self.player_list.len() {
            return;
        }
        if self.time == RoomPhase::Night {
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(socket_id),
                json!({ "key": "cannot_whisper_at_night" }),
            );
            return;
        }
        if !self.player_list[recipient].is_alive {
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(socket_id),
                json!({ "key": "invalid_whisper_recipient" }),
            );
            return;
        }
        let sender_name = self.player_list[sender_index].username.clone();
        let recipient_name = self.player_list[recipient].username.clone();
        let recipient_socket = self.player_list[recipient].socket_id.clone();
        self.emit_event(
            ServerEvent::ReceiveWhisperMessage,
            Some(&recipient_socket),
            json!(format!("Whisper from {sender_name}: {message}")),
        );
        self.emit_event(
            ServerEvent::ReceiveWhisperMessage,
            Some(socket_id),
            json!(format!("Whisper to {recipient_name}: {message}")),
        );
        let taps = [
            self.player_list[sender_index].day_tapped_by,
            self.player_list[recipient].day_tapped_by,
        ];
        for tap in taps.into_iter().flatten() {
            let tap_socket = self.player_list[tap].socket_id.clone();
            self.emit_event(
                ServerEvent::ReceiveWhisperMessage,
                Some(&tap_socket),
                json!(format!(
                    "{sender_name} whispered \"{message}\" to {recipient_name}."
                )),
            );
        }
    }

    pub fn handle_visit(&mut self, socket_id: &str, recipient: Option<usize>, phase: DayTime) {
        if !self.started || !self.phase_matches(phase) {
            return;
        }
        if recipient.is_some_and(|index| index >= self.player_list.len()) {
            return;
        }
        let Some(player_index) = self
            .player_list
            .iter()
            .position(|player| player.socket_id == socket_id)
        else {
            return;
        };
        if !self.player_list[player_index].is_alive || self.player_list[player_index].roleblocked {
            return;
        }
        let role = self.player_list[player_index].role.name;
        match self.time {
            RoomPhase::Day
                if matches!(role, "Tapper" | "Jailor") && recipient != Some(player_index) =>
            {
                self.player_list[player_index].day_target = recipient
            }
            RoomPhase::Night
                if matches!(role, "Nimby" | "Vetter") && recipient == Some(player_index) =>
            {
                self.player_list[player_index].night_target = recipient
            }
            RoomPhase::Night if role == "Jailor" && recipient == Some(player_index) => {
                self.player_list[player_index].night_target =
                    self.player_list[player_index].persistent_target
            }
            RoomPhase::Night
                if !matches!(role, "Mafia" | "Confesser" | "Framer" | "Blank Role")
                    && recipient != Some(player_index) =>
            {
                self.player_list[player_index].night_target = recipient
            }
            RoomPhase::Idle => {}
            _ => {}
        }
    }

    fn refresh_framer_targets(&mut self) {
        let alive = self
            .player_list
            .iter()
            .map(|p| p.is_alive)
            .collect::<Vec<_>>();
        let town = self
            .player_list
            .iter()
            .position(|p| p.is_alive && p.role.faction == Faction::Town);
        for player in &mut self.player_list {
            if player.role.name == "Framer"
                && !player.victory_condition
                && player
                    .persistent_target
                    .is_none_or(|i| !alive.get(i).copied().unwrap_or(false))
            {
                player.persistent_target = town;
            }
        }
    }

    pub fn resolve_day_vote(&self, votes_required: usize) -> Option<usize> {
        let highest = self
            .player_list
            .iter()
            .filter(|player| player.is_alive && player.votes_received >= votes_required)
            .map(|player| player.votes_received)
            .max()?;
        let leaders = self
            .player_list
            .iter()
            .enumerate()
            .filter(|(_, player)| player.is_alive && player.votes_received == highest)
            .map(|(index, _)| index)
            .collect::<Vec<_>>();
        (leaders.len() == 1).then_some(leaders[0])
    }

    fn phase_matches(&self, phase: DayTime) -> bool {
        matches!(
            (self.time, phase),
            (RoomPhase::Day, DayTime::Day) | (RoomPhase::Night, DayTime::Night)
        )
    }

    pub fn user_names(&self) -> Vec<&str> {
        self.user_list
            .iter()
            .map(|user| user.username.as_str())
            .collect()
    }

    pub fn player_count(&self) -> usize {
        self.player_list.len()
    }

    /// Removes and returns emissions produced since the previous drain.
    pub fn drain_emissions(&mut self) -> Vec<RoomEmission> {
        std::mem::take(&mut self.emissions)
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

    fn emit_no_args(&mut self, event: ServerEvent, target: Option<&str>) {
        self.emissions.push(RoomEmission {
            target: target.unwrap_or(&self.name).to_string(),
            event: event.as_str().to_string(),
            args: Vec::new(),
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

fn max_combat(left: CombatLevel, right: CombatLevel) -> CombatLevel {
    std::cmp::max(left, right)
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

    use crate::{
        protocol::{DayTime, JoinRoomResult, JoinRoomResultCode, ServerEvent},
        roles::{MAFIA_ROLES, NEUTRAL_ROLES, RoleDefinition, TOWN_ROLES},
        systems::Faction,
    };

    use super::{CombatLevel, Room, load_room_fixture};

    fn started_room() -> Room {
        let mut room = Room::new(3, "test-room");
        room.add_user("a");
        room.add_user("b");
        room.add_user("c");
        room.drain_emissions();
        room
    }

    fn room_with_roles(names: &[&str]) -> Room {
        let mut room = Room::new(names.len(), "simulation-room");
        for index in 0..names.len() {
            room.add_user(format!("socket-{index}"));
        }
        for (index, name) in names.iter().enumerate() {
            assign(&mut room, index, name);
        }
        room.drain_emissions();
        room
    }

    fn role(name: &str) -> RoleDefinition {
        TOWN_ROLES
            .iter()
            .chain(MAFIA_ROLES)
            .chain(NEUTRAL_ROLES)
            .find(|role| role.name == name)
            .copied()
            .unwrap()
    }

    fn assign(room: &mut Room, index: usize, name: &str) {
        room.player_list[index].role = role(name);
        room.player_list[index].defence = room.player_list[index].role.base_defence;
        room.player_list[index].defence_bonus = CombatLevel::None;
        room.player_list[index].persistent_target = None;
        room.player_list[index].night_target = None;
        room.player_list[index].day_target = None;
        room.player_list[index].faction_vote_target = None;
        room.player_list[index].visitors.clear();
        room.player_list[index].attackers.clear();
        room.player_list[index].insane = false;
        room.player_list[index].jailed_by = None;
        room.player_list[index].day_tapped_by = None;
        room.player_list[index].night_tapped_by = None;
        room.player_list[index].victory_condition = false;
        room.player_list[index].charges = if matches!(name, "Nimby" | "Vetter") {
            3
        } else {
            0
        };
    }

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
        assert_eq!(
            room.user_names(),
            fixture
                .expected_state
                .user_names
                .iter()
                .map(String::as_str)
                .collect::<Vec<_>>()
        );
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

    #[test]
    fn lobby_disconnect_removes_user_and_emits_departure() {
        let mut room = Room::new(3, "test-room");
        room.add_user("a");
        room.add_user("b");
        room.drain_emissions();
        room.remove_player("a");
        assert_eq!(room.user_names(), vec!["Finn"]);
        assert!(
            room.emissions
                .iter()
                .any(|event| event.event == ServerEvent::RemovePlayer.as_str())
        );
        assert!(
            room.emissions
                .iter()
                .any(|event| event.message_key.as_deref() == Some("player_left_room"))
        );
    }

    #[test]
    fn in_game_disconnect_marks_fatal_damage() {
        let mut room = started_room();
        room.remove_player("b");
        assert_eq!(room.player_list[1].damage, CombatLevel::Fatal);
        assert!(
            room.emissions
                .iter()
                .any(|event| event.message_key.as_deref() == Some("player_abandoned_game"))
        );
    }

    #[test]
    fn vote_rejects_self_and_duplicate_then_resolves_unique_quorum() {
        let mut room = started_room();
        room.handle_vote("a", 0, DayTime::Day);
        assert_eq!(room.emissions[0].target, "a");
        assert_eq!(
            room.emissions[0].message_key.as_deref(),
            Some("cannot_vote_yourself")
        );
        room.drain_emissions();
        room.handle_vote("a", 2, DayTime::Day);
        room.handle_vote("a", 1, DayTime::Day);
        room.handle_vote("b", 2, DayTime::Day);
        assert_eq!(room.player_list[2].votes_received, 2);
        assert_eq!(room.resolve_day_vote(2), Some(2));
        assert!(
            room.emissions
                .iter()
                .any(|event| event.message_key.as_deref() == Some("cannot_change_vote"))
        );
    }

    #[test]
    fn wrong_phase_actions_do_not_mutate_state() {
        let mut room = started_room();
        room.handle_vote("a", 1, DayTime::Night);
        room.handle_visit("a", Some(1), DayTime::Night);
        assert!(!room.player_list[0].has_voted);
        assert_eq!(room.player_list[0].day_target, None);
        assert_eq!(room.player_list[0].night_target, None);
        assert!(room.emissions.is_empty());
    }

    #[test]
    fn whisper_is_delivered_only_to_sender_and_recipient() {
        let mut room = started_room();
        room.handle_whisper("a", 1, "secret", DayTime::Day);
        assert_eq!(room.emissions.len(), 2);
        assert_eq!(room.emissions[0].target, "b");
        assert_eq!(room.emissions[1].target, "a");
        assert!(
            room.emissions
                .iter()
                .all(|event| event.event == ServerEvent::ReceiveWhisperMessage.as_str())
        );
    }

    #[test]
    fn joining_rejects_duplicate_sockets_and_full_rooms() {
        let mut room = Room::new(2, "join-rules");
        assert!(matches!(room.add_user("a"), JoinRoomResult::Joined { .. }));
        assert_eq!(
            room.add_user("a"),
            JoinRoomResult::Rejected {
                code: JoinRoomResultCode::GenericError
            }
        );
        room.add_user("b");
        assert_eq!(
            room.add_user("c"),
            JoinRoomResult::Rejected {
                code: JoinRoomResultCode::RoomFull
            }
        );
    }

    #[test]
    fn game_start_assigns_every_player_a_known_role_and_private_event() {
        let room = started_room();
        assert_eq!(room.day_number, 1);
        assert_eq!(room.time, super::RoomPhase::Day);
        assert_eq!(room.player_list.len(), 3);
        for player in &room.player_list {
            assert!(
                TOWN_ROLES
                    .iter()
                    .chain(MAFIA_ROLES)
                    .chain(NEUTRAL_ROLES)
                    .any(|role| role.name == player.role.name)
            );
        }
    }

    #[test]
    fn starting_night_resets_temporary_actions_but_preserves_abandonment() {
        let mut room = started_room();
        room.player_list[0].has_voted = true;
        room.player_list[0].night_target = Some(1);
        room.player_list[0].damage = CombatLevel::High;
        room.player_list[1].abandoned = true;
        room.start_night();
        assert!(!room.player_list[0].has_voted);
        assert_eq!(room.player_list[0].night_target, None);
        assert_eq!(room.player_list[0].damage, CombatLevel::None);
        assert_eq!(room.player_list[1].damage, CombatLevel::Fatal);
    }

    #[test]
    fn tied_day_vote_does_not_eliminate_and_advances_to_night() {
        let mut room = started_room();
        assign(&mut room, 0, "Doctor");
        assign(&mut room, 1, "Mafia");
        assign(&mut room, 2, "Sniper");
        room.player_list[0].votes_received = 2;
        room.player_list[1].votes_received = 2;
        room.finish_day();
        assert!(room.player_list.iter().all(|player| player.is_alive));
        assert_eq!(room.time, super::RoomPhase::Night);
    }

    #[test]
    fn unique_quorum_eliminates_and_emits_protocol_complete_death() {
        let mut room = started_room();
        assign(&mut room, 0, "Doctor");
        assign(&mut room, 1, "Mafia");
        assign(&mut room, 2, "Sniper");
        room.drain_emissions();
        room.player_list[1].votes_received = 2;
        room.finish_day();
        assert!(!room.player_list[1].is_alive);
        assert!(room.emissions.iter().any(|event| {
            event.target == "b"
                && event.event == ServerEvent::BlockMessages.as_str()
                && event.args.is_empty()
        }));
        assert!(room.emissions.iter().any(|event| {
            event.event == ServerEvent::UpdatePlayerRole.as_str() && event.target == "test-room"
        }));
    }

    #[test]
    fn doctor_defence_prevents_mafia_faction_kill() {
        let mut room = started_room();
        assign(&mut room, 0, "Mafia");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Investigator");
        room.start_night();
        room.handle_vote("a", 2, DayTime::Night);
        room.handle_visit("b", Some(2), DayTime::Night);
        room.finish_night();
        assert!(room.player_list[2].is_alive);
        assert!(room.emissions.iter().any(|event| {
            event.target == "c" && event.message_key.as_deref() == Some("attacked_but_survived")
        }));
    }

    #[test]
    fn roleblock_resolves_before_blocked_players_visit() {
        let mut room = started_room();
        assign(&mut room, 0, "Doctor");
        assign(&mut room, 1, "Roleblocker");
        assign(&mut room, 2, "Mafia");
        room.start_night();
        room.handle_visit("a", Some(1), DayTime::Night);
        room.handle_visit("b", Some(0), DayTime::Night);
        room.handle_vote("c", 1, DayTime::Night);
        room.finish_night();
        assert!(room.player_list[0].roleblocked);
        assert!(!room.player_list[1].is_alive);
    }

    #[test]
    fn night_faction_votes_reject_town_voters_and_mafia_targets() {
        let mut room = started_room();
        assign(&mut room, 0, "Mafia");
        assign(&mut room, 1, "Mafia Investigator");
        assign(&mut room, 2, "Doctor");
        room.start_night();
        room.handle_vote("c", 0, DayTime::Night);
        room.handle_vote("a", 1, DayTime::Night);
        assert_eq!(room.player_list[2].faction_vote_target, None);
        assert_eq!(room.player_list[0].faction_vote_target, None);
        room.handle_vote("a", 2, DayTime::Night);
        assert_eq!(room.player_list[0].faction_vote_target, Some(2));
    }

    #[test]
    fn high_attack_kills_low_defence_and_announces_winner() {
        let mut room = started_room();
        assign(&mut room, 0, "Sniper");
        assign(&mut room, 1, "Confesser");
        assign(&mut room, 2, "Doctor");
        room.player_list[1].is_alive = false;
        room.start_night();
        room.handle_visit("a", Some(2), DayTime::Night);
        room.finish_night();
        assert!(!room.player_list[2].is_alive);
        assert!(room.game_has_ended);
        assert!(room.emissions.iter().any(|event| {
            event.message_key.as_deref() == Some("faction_won")
                || event.message_key.as_deref() == Some("neutral_players_won")
        }));
    }

    #[test]
    fn abandoned_player_dies_during_night_resolution() {
        let mut room = started_room();
        assign(&mut room, 0, "Doctor");
        assign(&mut room, 1, "Mafia");
        assign(&mut room, 2, "Sniper");
        room.remove_player("a");
        room.start_night();
        room.finish_night();
        assert!(!room.player_list[0].is_alive);
        assert!(room.emissions.iter().any(|event| {
            event.target == "a" && event.message_key.as_deref() == Some("you_have_died")
        }));
    }

    #[test]
    fn dead_and_night_players_cannot_use_public_chat() {
        let mut room = started_room();
        room.player_list[0].is_alive = false;
        room.handle_message("a", "boo", DayTime::Day);
        assert_eq!(
            room.emissions[0].message_key.as_deref(),
            Some("cannot_speak_you_are_dead")
        );
        room.drain_emissions();
        room.player_list[0].is_alive = true;
        room.start_night();
        room.drain_emissions();
        room.handle_message("a", "hello", DayTime::Night);
        assert_eq!(
            room.emissions[0].message_key.as_deref(),
            Some("cannot_speak_at_night")
        );
    }

    #[test]
    fn invalid_visit_targets_never_mutate_selected_target() {
        let mut room = started_room();
        room.handle_visit("a", Some(99), DayTime::Day);
        assert_eq!(room.player_list[0].day_target, None);
        room.handle_visit("missing", Some(1), DayTime::Day);
        assert!(
            room.player_list
                .iter()
                .all(|player| player.day_target.is_none())
        );
    }

    #[test]
    fn victory_waits_while_living_non_neutral_factions_conflict() {
        let mut room = started_room();
        assign(&mut room, 0, "Doctor");
        assign(&mut room, 1, "Mafia");
        assign(&mut room, 2, "Peacemaker");
        assert!(!room.finish_if_winner());
        room.player_list[1].is_alive = false;
        assert!(room.finish_if_winner());
        assert_eq!(room.player_list[0].role.faction, Faction::Town);
    }

    #[test]
    fn framer_tracks_a_living_town_target_and_wins_on_vote_out() {
        let mut room = started_room();
        assign(&mut room, 0, "Framer");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.refresh_framer_targets();
        assert_eq!(room.player_list[0].persistent_target, Some(1));
        room.player_list[1].votes_received = 2;
        room.finish_day();
        assert!(room.player_list[0].victory_condition);
    }

    #[test]
    fn confesser_vote_out_wins_and_disables_future_voting() {
        let mut room = started_room();
        assign(&mut room, 0, "Confesser");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.player_list[0].votes_received = 2;
        room.finish_day();
        assert!(room.voting_disabled);
        assert!(room.player_list[0].victory_condition);
        room.start_day(2);
        room.drain_emissions();
        room.handle_vote("b", 2, DayTime::Day);
        assert_eq!(room.player_list[2].votes_received, 0);
    }

    #[test]
    fn peacemaker_wins_the_configured_no_death_draw() {
        let mut room = started_room();
        assign(&mut room, 0, "Peacemaker");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.start_day(3);
        assert!(room.game_has_ended);
        assert!(room.player_list[0].victory_condition);
    }

    #[test]
    fn jailor_jails_by_day_executes_at_night_and_private_chat_routes() {
        let mut room = started_room();
        assign(&mut room, 0, "Jailor");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.handle_visit("a", Some(1), DayTime::Day);
        room.finish_day();
        assert_eq!(room.player_list[1].jailed_by, Some(0));
        room.drain_emissions();
        room.handle_message("b", "help", DayTime::Night);
        assert!(
            room.emissions
                .iter()
                .any(|e| e.target == "a" && e.event == ServerEvent::ReceiveChatMessage.as_str())
        );
        room.handle_visit("a", Some(0), DayTime::Night);
        room.finish_night();
        assert!(!room.player_list[1].is_alive);
    }

    #[test]
    fn nimby_and_vetter_consume_limited_self_action_charges() {
        for name in ["Nimby", "Vetter"] {
            let mut room = started_room();
            assign(&mut room, 0, name);
            assign(&mut room, 1, "Mafia");
            assign(&mut room, 2, "Doctor");
            room.start_night();
            room.handle_visit("a", Some(0), DayTime::Night);
            room.resolve_night_actions();
            assert_eq!(room.player_list[0].charges, 2, "{name}");
        }
    }

    #[test]
    fn tapper_overhears_whispers_involving_day_tapped_player() {
        let mut room = started_room();
        assign(&mut room, 0, "Tapper");
        room.start_night();
        room.handle_visit("a", Some(1), DayTime::Night);
        room.resolve_night_actions();
        room.start_day(2);
        room.drain_emissions();
        room.handle_whisper("b", 2, "secret", DayTime::Day);
        assert!(
            room.emissions.iter().any(
                |e| e.target == "a" && e.args[0].as_str().is_some_and(|s| s.contains("secret"))
            )
        );
    }

    #[test]
    fn investigator_judge_tracker_watchman_and_mafia_investigator_report_results() {
        for (name, key) in [
            ("Investigator", "investigator_result"),
            ("Judge", "judge_alignment_result"),
            ("Tracker", "tracker_target_did_not_visit"),
            ("Watchman", "watchman_visitor_list"),
            ("Mafia Investigator", "mafia_investigator_result"),
        ] {
            let mut room = started_room();
            assign(&mut room, 0, name);
            assign(&mut room, 1, "Doctor");
            assign(&mut room, 2, "Mafia");
            room.start_night();
            room.drain_emissions();
            room.handle_visit("a", Some(1), DayTime::Night);
            room.resolve_night_actions();
            assert!(
                room.emissions
                    .iter()
                    .any(|e| e.message_key.as_deref() == Some(key)),
                "{name}"
            );
        }
    }

    #[test]
    fn lawman_insanity_bodyguard_sacrifice_and_sniper_damage_resolve() {
        let mut room = started_room();
        assign(&mut room, 0, "Lawman");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.start_night();
        room.handle_visit("a", Some(1), DayTime::Night);
        room.resolve_night_actions();
        assert!(room.player_list[0].insane);

        let mut room = started_room();
        assign(&mut room, 0, "Sacrificer");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.start_night();
        room.handle_visit("a", Some(1), DayTime::Night);
        room.handle_vote("c", 1, DayTime::Night);
        room.resolve_night_actions();
        assert_eq!(room.player_list[0].damage, CombatLevel::Critical);
        assert_eq!(room.player_list[1].defence, CombatLevel::High);

        let mut room = started_room();
        assign(&mut room, 0, "Sniper");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.start_night();
        room.handle_visit("a", Some(1), DayTime::Night);
        room.resolve_night_actions();
        assert_eq!(room.player_list[1].damage, CombatLevel::High);
    }

    fn exercise_role_mechanic(name: &str) {
        let companions = if name.starts_with("Mafia") || name == "Mafia" {
            [name, "Doctor", "Investigator"]
        } else {
            [name, "Doctor", "Mafia"]
        };
        let mut room = room_with_roles(&companions);
        match name {
            "Mafia" => {
                room.start_night();
                room.handle_vote("socket-0", 1, DayTime::Night);
                assert_eq!(room.player_list[0].faction_vote_target, Some(1));
            }
            "Mafia Investigator" | "Investigator" | "Judge" | "Tracker" | "Watchman" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.resolve_night_actions();
                assert!(
                    room.emissions
                        .iter()
                        .any(|event| event.target == "socket-0" && event.message_key.is_some())
                );
            }
            "Mafia Roleblocker" | "Roleblocker" | "Peacemaker" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                assert_eq!(room.player_list[0].night_target, Some(1));
            }
            "Bodyguard" | "Doctor" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.resolve_night_actions();
                assert!(room.player_list[1].defence >= CombatLevel::Low);
            }
            "Fortifier" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.resolve_night_actions();
                assert_eq!(room.player_list[0].persistent_target, Some(1));
                assert_eq!(room.player_list[1].defence_bonus, CombatLevel::Medium);
            }
            "Jailor" => {
                room.handle_visit("socket-0", Some(1), DayTime::Day);
                room.resolve_day_actions();
                assert_eq!(room.player_list[1].jailed_by, Some(0));
            }
            "Lawman" | "Maniac" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.resolve_night_actions();
                assert!(room.player_list[1].damage >= CombatLevel::Low);
            }
            "Nimby" | "Vetter" => {
                room.start_night();
                room.handle_visit("socket-0", Some(0), DayTime::Night);
                room.resolve_night_actions();
                assert_eq!(room.player_list[0].charges, 2);
            }
            "Sacrificer" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.handle_vote("socket-2", 1, DayTime::Night);
                room.resolve_night_actions();
                assert_eq!(room.player_list[0].damage, CombatLevel::Critical);
            }
            "Tapper" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.resolve_night_actions();
                assert_eq!(room.player_list[1].day_tapped_by, Some(0));
            }
            "Confesser" => {
                room.player_list[0].votes_received = 2;
                room.finish_day();
                assert!(room.player_list[0].victory_condition && room.voting_disabled);
            }
            "Framer" => {
                room.refresh_framer_targets();
                assert!(room.player_list[0].persistent_target.is_some());
            }
            "Sniper" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.resolve_night_actions();
                assert_eq!(room.player_list[1].damage, CombatLevel::High);
            }
            other => panic!("missing role test scenario for {other}"),
        }
    }

    macro_rules! role_unit_tests {
        ($($test:ident => $role:literal),+ $(,)?) => {$(
            #[test]
            fn $test() { exercise_role_mechanic($role); }
        )+};
    }

    role_unit_tests! {
        bodyguard_role_mechanic => "Bodyguard", doctor_role_mechanic => "Doctor",
        fortifier_role_mechanic => "Fortifier", investigator_role_mechanic => "Investigator",
        jailor_role_mechanic => "Jailor", judge_role_mechanic => "Judge",
        lawman_role_mechanic => "Lawman", nimby_role_mechanic => "Nimby",
        roleblocker_role_mechanic => "Roleblocker", sacrificer_role_mechanic => "Sacrificer",
        tapper_role_mechanic => "Tapper", tracker_role_mechanic => "Tracker",
        vetter_role_mechanic => "Vetter", watchman_role_mechanic => "Watchman",
        mafia_role_mechanic => "Mafia", mafia_investigator_role_mechanic => "Mafia Investigator",
        mafia_roleblocker_role_mechanic => "Mafia Roleblocker", confesser_role_mechanic => "Confesser",
        framer_role_mechanic => "Framer", maniac_role_mechanic => "Maniac",
        peacemaker_role_mechanic => "Peacemaker", sniper_role_mechanic => "Sniper",
    }

    #[test]
    fn mocked_gameplay_runs_day_night_vote_and_town_victory() {
        let mut room = room_with_roles(&["Mafia", "Doctor", "Investigator", "Judge"]);
        room.finish_day();
        assert_eq!(room.time, super::RoomPhase::Night);
        room.handle_vote("socket-0", 2, DayTime::Night);
        room.handle_visit("socket-1", Some(2), DayTime::Night);
        room.finish_night();
        assert!(room.player_list[2].is_alive);
        assert_eq!(room.time, super::RoomPhase::Day);
        for voter in 1..4 {
            room.handle_vote(&format!("socket-{voter}"), 0, DayTime::Day);
        }
        room.finish_day();
        assert!(!room.player_list[0].is_alive);
        assert!(room.game_has_ended);
    }

    #[test]
    fn mocked_gameplay_runs_repeated_empty_cycles_to_peacemaker_draw() {
        let mut room = room_with_roles(&["Peacemaker", "Doctor", "Mafia"]);
        room.finish_day();
        room.finish_night();
        assert_eq!(room.day_number, 2);
        room.finish_day();
        room.finish_night();
        assert!(room.game_has_ended);
        assert!(room.player_list[0].victory_condition);
    }
}
