use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::{
    protocol::{DayTime, JoinRoomResult, JoinRoomResultCode, ServerEvent},
    roles::{RoleDefinition, RoleKind, assign_roles, shuffle_roles},
    systems::{
        DamageOutcome, Faction, VoteOutcome, determine_winner, resolve_damage, resolve_vote,
    },
};

const DEFAULT_NAMES: [&str; 20] = [
    "Glen", "Finn", "Alex", "Joey", "Noel", "Jade", "Nico", "Abby", "Liam", "Ivan", "Adam", "Ella",
    "Erin", "Jane", "Lily", "Ruth", "Rhys", "Todd", "Reid", "Mara",
];

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RoomPhase {
    #[default]
    Idle,
    Day,
    Night,
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
                charges: role.kind.starting_charges(),
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
                    "dayVisitOthers": player.role.kind.can_day_visit_others(),
                    "dayVisitFaction": false,
                    "nightVisitSelf": player.role.kind.can_night_visit_self(),
                    "nightVisitOthers": player.role.kind.can_night_visit_others(),
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
                if player.role.kind == RoleKind::Peacemaker {
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
            let voted_socket = self.player_list.get(player).map(|p| p.socket_id.clone());
            for role in &mut self.player_list {
                if role.role.kind == RoleKind::Framer && role.persistent_target == Some(player) {
                    role.victory_condition = true;
                }
                if role.role.kind == RoleKind::Confesser
                    && Some(&role.socket_id) == voted_socket.as_ref()
                {
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
            let Some(player) = self.player_list.get(index) else {
                continue;
            };
            if !player.is_alive {
                continue;
            }
            let outcome = resolve_damage(player.damage, player.defence, player.role.base_defence);
            match outcome {
                DamageOutcome::Died => self.kill_player(index, "you_have_died"),
                DamageOutcome::Survived => {
                    let socket = self.player_list.get(index).map(|p| p.socket_id.clone());
                    if let Some(socket) = socket {
                        self.emit_message(
                            ServerEvent::ReceiveMessage,
                            Some(&socket),
                            json!({ "key": "attacked_but_survived" }),
                        );
                    }
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
            .filter(|(target, _)| self.player_list.get(**target).is_some_and(|p| p.is_alive))
            .max_by_key(|(target, votes)| (**votes, std::cmp::Reverse(**target)))
        {
            if let Some(target_player) = self.player_list.get_mut(target) {
                target_player.damage = max_combat(target_player.damage, CombatLevel::Low);
            }
            if let (Some(attacker), Some(target_player)) = (
                self.player_list
                    .iter()
                    .position(|player| player.is_alive && player.role.faction == Faction::Mafia),
                self.player_list.get_mut(target),
            ) {
                target_player.attackers.push(attacker);
            }
        }
        let actions = self
            .player_list
            .iter()
            .enumerate()
            .filter_map(|(index, player)| {
                player
                    .is_alive
                    .then_some((index, player.night_target, player.role.kind))
            })
            .collect::<Vec<_>>();
        for (actor, target, role) in actions.iter().copied().filter(|(_, _, role)| {
            matches!(
                *role,
                RoleKind::Roleblocker
                    | RoleKind::MafiaRoleblocker
                    | RoleKind::Peacemaker
                    | RoleKind::Jailor
            )
        }) {
            let Some(target) = target else { continue };
            let actor_roleblocked = self.player_list.get(actor).is_some_and(|p| p.roleblocked);
            let target_is_alive = self.player_list.get(target).is_some_and(|p| p.is_alive);
            let target_is_town = self
                .player_list
                .get(target)
                .is_some_and(|p| p.role.faction == Faction::Town);
            if target_is_alive
                && !actor_roleblocked
                && (role == RoleKind::Peacemaker || target_is_town || rand::random::<f64>() > 0.5)
                && let Some(target_player) = self.player_list.get_mut(target)
            {
                target_player.roleblocked = true;
                target_player.visitors.push(actor);
            }
        }
        for (actor, target, role) in actions.iter().copied().filter(|(_, _, role)| {
            !matches!(
                *role,
                RoleKind::Roleblocker
                    | RoleKind::MafiaRoleblocker
                    | RoleKind::Peacemaker
                    | RoleKind::Jailor
            )
        }) {
            let Some(target) = target else { continue };
            let target_is_alive = self.player_list.get(target).is_some_and(|p| p.is_alive);
            let actor_roleblocked = self.player_list.get(actor).is_some_and(|p| p.roleblocked);
            if !target_is_alive || actor_roleblocked {
                continue;
            }
            if actor == target && !matches!(role, RoleKind::Nimby | RoleKind::Vetter) {
                continue;
            }
            if let Some(target_player) = self.player_list.get_mut(target) {
                target_player.visitors.push(actor);
            }
            match role {
                RoleKind::Doctor | RoleKind::Bodyguard => {
                    if let Some(target_player) = self.player_list.get_mut(target) {
                        target_player.defence = max_combat(target_player.defence, CombatLevel::Low);
                    }
                }
                RoleKind::Sacrificer => {}
                RoleKind::Fortifier => self.resolve_fortifier(actor, target),
                RoleKind::Lawman | RoleKind::Maniac => {
                    let target_is_town = self
                        .player_list
                        .get(target)
                        .is_some_and(|p| p.role.faction == Faction::Town);
                    if let Some(target_player) = self.player_list.get_mut(target) {
                        target_player.damage = max_combat(target_player.damage, CombatLevel::Low);
                        target_player.attackers.push(actor);
                    }
                    if role == RoleKind::Lawman
                        && target_is_town
                        && let Some(actor_player) = self.player_list.get_mut(actor)
                    {
                        actor_player.insane = true;
                    }
                }
                RoleKind::Investigator => self.emit_investigation(actor, target, false),
                RoleKind::MafiaInvestigator => self.emit_investigation(actor, target, true),
                RoleKind::Judge => self.emit_judgement(actor, target),
                RoleKind::Nimby => {
                    if let Some(actor_player) = self.player_list.get_mut(actor)
                        && actor_player.charges > 0
                    {
                        actor_player.charges -= 1;
                        actor_player.defence = max_combat(actor_player.defence, CombatLevel::Low);
                    }
                }
                RoleKind::Vetter => {
                    let has_charges = self.player_list.get(actor).is_some_and(|p| p.charges > 0);
                    if has_charges {
                        if let Some(actor_player) = self.player_list.get_mut(actor) {
                            actor_player.charges -= 1;
                        }
                        self.emit_vetter_result(actor);
                    }
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
                    .then_some((actor, player.day_target, player.role.kind))
            })
            .collect::<Vec<_>>();
        for (actor, target, role) in actions {
            let Some(target) = target else { continue };
            if actor == target
                || target >= self.player_list.len()
                || !self.player_list.get(target).is_some_and(|p| p.is_alive)
            {
                continue;
            }
            match role {
                RoleKind::Jailor => {
                    if let Some(actor_player) = self.player_list.get_mut(actor) {
                        actor_player.persistent_target = Some(target);
                    }
                    if let Some(target_player) = self.player_list.get_mut(target) {
                        target_player.jailed_by = Some(actor);
                        target_player.roleblocked = true;
                    }
                }
                RoleKind::Tapper => {
                    if let Some(target_player) = self.player_list.get_mut(target) {
                        target_player.night_tapped_by = Some(actor);
                    }
                }
                _ => {}
            }
        }
    }

    fn resolve_fortifier(&mut self, actor: usize, target: usize) {
        let persistent = self
            .player_list
            .get(actor)
            .and_then(|p| p.persistent_target);
        match persistent {
            None => {
                if let Some(actor_player) = self.player_list.get_mut(actor) {
                    actor_player.persistent_target = Some(target);
                }
                if let Some(target_player) = self.player_list.get_mut(target) {
                    target_player.defence_bonus = CombatLevel::Medium;
                    target_player.defence = max_combat(target_player.defence, CombatLevel::Medium);
                }
            }
            Some(previous) if previous == target => {
                if let Some(actor_player) = self.player_list.get_mut(actor) {
                    actor_player.persistent_target = None;
                }
                if let Some(target_player) = self.player_list.get_mut(target) {
                    target_player.defence_bonus = CombatLevel::None;
                }
                if rand::random::<f64>() > 0.5 {
                    if let Some(actor_player) = self.player_list.get_mut(actor) {
                        actor_player.damage = CombatLevel::Fatal;
                    }
                } else if let Some(target_player) = self.player_list.get_mut(target) {
                    target_player.damage = CombatLevel::Fatal;
                }
            }
            Some(_) => {}
        }
    }

    fn emit_investigation(&mut self, actor: usize, target: usize, exact: bool) {
        let Some(actor_player) = self.player_list.get(actor) else {
            return;
        };
        let socket = actor_player.socket_id.clone();
        let Some(target_player) = self.player_list.get(target) else {
            return;
        };
        let target_name = target_player.username.clone();
        let role_name = target_player.role.name;
        let key = if exact {
            "mafia_investigator_result"
        } else {
            "investigator_result"
        };
        self.emit_message(
            ServerEvent::ReceiveMessage,
            Some(&socket),
            if exact {
                json!({"key": key, "params": {"targetName": target_name, "roleName": role_name}})
            } else {
                json!({"key": key, "params": {"targetName": target_name, "role1": role_name, "role2": role_name, "role3": role_name}})
            },
        );
    }

    fn emit_judgement(&mut self, actor: usize, target: usize) {
        let Some(actor_player) = self.player_list.get(actor) else {
            return;
        };
        let socket = actor_player.socket_id.clone();
        let Some(target_player) = self.player_list.get(target) else {
            return;
        };
        let target_name = target_player.username.clone();
        let faction = target_player.role.faction;
        self.emit_message(
            ServerEvent::ReceiveMessage,
            Some(&socket),
            json!({"key":"judge_alignment_result", "params":{"targetName":target_name, "factionName":faction}}),
        );
    }

    fn emit_vetter_result(&mut self, actor: usize) {
        if self.player_list.is_empty() {
            return;
        }
        let Some(actor_player) = self.player_list.get(actor) else {
            return;
        };
        let socket = actor_player.socket_id.clone();
        let first = (actor + 1) % self.player_list.len();
        let second = (actor + 2) % self.player_list.len();
        let Some(first_player) = self.player_list.get(first) else {
            return;
        };
        let name1 = first_player.username.clone();
        let role_name = first_player.role.name;
        let Some(second_player) = self.player_list.get(second) else {
            return;
        };
        let name2 = second_player.username.clone();
        self.emit_message(
            ServerEvent::ReceiveMessage,
            Some(&socket),
            json!({"key":"vetter_research_result", "params":{"name1":name1,"name2":name2,"roleName":role_name}}),
        );
    }

    fn resolve_visit_outcomes(&mut self, actions: &[(usize, Option<usize>, RoleKind)]) {
        for (actor, target, role) in actions.iter().copied() {
            let Some(target) = target else { continue };
            let actor_roleblocked = self.player_list.get(actor).is_some_and(|p| p.roleblocked);
            if target >= self.player_list.len() || actor_roleblocked {
                continue;
            }
            match role {
                RoleKind::Bodyguard => {
                    let attackers = self
                        .player_list
                        .get(target)
                        .map(|p| p.attackers.clone())
                        .unwrap_or_default();
                    for visitor in attackers {
                        if visitor != actor
                            && let Some(visitor_player) = self.player_list.get_mut(visitor)
                        {
                            visitor_player.damage =
                                max_combat(visitor_player.damage, CombatLevel::Low);
                        }
                    }
                }
                RoleKind::Sacrificer => {
                    let has_attackers = self
                        .player_list
                        .get(target)
                        .is_some_and(|p| !p.attackers.is_empty());
                    if has_attackers {
                        if let Some(target_player) = self.player_list.get_mut(target) {
                            target_player.defence = CombatLevel::High;
                        }
                        if let Some(actor_player) = self.player_list.get_mut(actor) {
                            actor_player.damage = CombatLevel::Critical;
                        }
                    }
                }
                RoleKind::Nimby => {
                    let visitors = self
                        .player_list
                        .get(actor)
                        .map(|p| p.visitors.clone())
                        .unwrap_or_default();
                    for visitor in visitors {
                        if visitor != actor
                            && let Some(visitor_player) = self.player_list.get_mut(visitor)
                        {
                            visitor_player.damage =
                                max_combat(visitor_player.damage, CombatLevel::Low);
                        }
                    }
                }
                RoleKind::Sniper => {
                    let stationary = self.player_list.get(target).is_some_and(|p| {
                        p.night_target.is_none() || p.night_target == Some(target)
                    });
                    let repeated = self
                        .player_list
                        .get(actor)
                        .is_some_and(|p| p.persistent_target == Some(target));
                    let no_damage = self
                        .player_list
                        .get(target)
                        .is_some_and(|p| p.damage == CombatLevel::None);
                    if stationary {
                        if let Some(target_player) = self.player_list.get_mut(target) {
                            target_player.damage =
                                max_combat(target_player.damage, CombatLevel::High);
                        }
                    } else if repeated
                        && no_damage
                        && let Some(target_player) = self.player_list.get_mut(target)
                    {
                        target_player.damage = CombatLevel::Low;
                    }
                    if let Some(actor_player) = self.player_list.get_mut(actor) {
                        actor_player.persistent_target = Some(target);
                    }
                }
                RoleKind::Tracker => {
                    let socket = self.player_list.get(actor).map(|p| p.socket_id.clone());
                    let visit = self
                        .player_list
                        .get(target)
                        .and_then(|p| p.night_target)
                        .and_then(|i| self.player_list.get(i).map(|p| p.username.clone()));
                    if let Some(socket) = socket {
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
                }
                RoleKind::Watchman => {
                    let names = self
                        .player_list
                        .get(target)
                        .map(|p| {
                            p.visitors
                                .iter()
                                .filter(|i| **i != actor)
                                .filter_map(|i| {
                                    self.player_list.get(*i).map(|p| p.username.clone())
                                })
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default();
                    let socket = self.player_list.get(actor).map(|p| p.socket_id.clone());
                    if let Some(socket) = socket {
                        self.emit_message(
                            ServerEvent::ReceiveMessage,
                            Some(&socket),
                            json!({"key":"watchman_visitor_list","params":{"list":names.join(", ")}}),
                        );
                    }
                }
                RoleKind::Tapper => {
                    if let Some(target_player) = self.player_list.get_mut(target) {
                        target_player.day_tapped_by = Some(actor);
                    }
                }
                RoleKind::Jailor => {
                    let persistent = self
                        .player_list
                        .get(actor)
                        .and_then(|p| p.persistent_target);
                    if persistent == Some(target)
                        && let Some(target_player) = self.player_list.get_mut(target)
                    {
                        target_player.damage = max_combat(target_player.damage, CombatLevel::High);
                        target_player.attackers.push(actor);
                    }
                }
                _ => {}
            }
        }
    }

    fn kill_player(&mut self, index: usize, personal_message: &str) {
        let Some(player) = self.player_list.get_mut(index) else {
            return;
        };
        if !player.is_alive {
            return;
        }
        player.is_alive = false;
        self.no_death_end_day = self.day_number + 3;
        let player = player.clone();
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
                (player.role.kind == RoleKind::Jailor)
                    .then_some(player)
                    .and_then(|_| {
                        self.player_list
                            .iter()
                            .position(|p| p.socket_id == socket_id)
                    })
                    .and_then(|i| self.player_list.get(i).and_then(|p| p.persistent_target))
            }) {
                let target_socket = self.player_list.get(jailor).map(|p| p.socket_id.clone());
                if let Some(target_socket) = target_socket {
                    self.emit_event(
                        ServerEvent::ReceiveChatMessage,
                        Some(&target_socket),
                        json!(format!("Jail: {message}")),
                    );
                    return;
                }
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
            let voter_alive = self
                .player_list
                .get(voter_index)
                .is_some_and(|p| p.is_alive);
            let voter_is_mafia = self
                .player_list
                .get(voter_index)
                .is_some_and(|p| p.role.faction == Faction::Mafia);
            let recipient_alive = self.player_list.get(recipient).is_some_and(|p| p.is_alive);
            let recipient_not_mafia = self
                .player_list
                .get(recipient)
                .is_some_and(|p| p.role.faction != Faction::Mafia);
            if voter_alive
                && voter_is_mafia
                && recipient_alive
                && recipient_not_mafia
                && let Some(voter_player) = self.player_list.get_mut(voter_index)
            {
                voter_player.faction_vote_target = Some(recipient);
            }
            return;
        }
        let voter_has_voted = self
            .player_list
            .get(voter_index)
            .is_some_and(|p| p.has_voted);
        if voter_has_voted {
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
        let recipient_is_alive = self.player_list.get(recipient).is_some_and(|p| p.is_alive);
        if !recipient_is_alive {
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(socket_id),
                json!({ "key": "vote_invalid" }),
            );
            return;
        }
        if let Some(voter_player) = self.player_list.get_mut(voter_index) {
            voter_player.has_voted = true;
        }
        let (voter, target, count) = {
            let voter = self
                .player_list
                .get(voter_index)
                .map(|p| p.username.clone())
                .unwrap_or_default();
            if let Some(recipient_player) = self.player_list.get_mut(recipient) {
                recipient_player.votes_received += 1;
                (
                    voter,
                    recipient_player.username.clone(),
                    recipient_player.votes_received,
                )
            } else {
                return;
            }
        };
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
        let recipient_is_alive = self.player_list.get(recipient).is_some_and(|p| p.is_alive);
        if !recipient_is_alive {
            self.emit_message(
                ServerEvent::ReceiveMessage,
                Some(socket_id),
                json!({ "key": "invalid_whisper_recipient" }),
            );
            return;
        }
        let sender_name = self
            .player_list
            .get(sender_index)
            .map(|p| p.username.clone())
            .unwrap_or_default();
        let (recipient_name, recipient_socket) = self
            .player_list
            .get(recipient)
            .map(|p| (p.username.clone(), p.socket_id.clone()))
            .unwrap_or_default();
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
            self.player_list
                .get(sender_index)
                .and_then(|p| p.day_tapped_by),
            self.player_list
                .get(recipient)
                .and_then(|p| p.day_tapped_by),
        ];
        for tap in taps.into_iter().flatten() {
            if let Some(tap_socket) = self.player_list.get(tap).map(|p| p.socket_id.clone()) {
                self.emit_event(
                    ServerEvent::ReceiveWhisperMessage,
                    Some(&tap_socket),
                    json!(format!(
                        "{sender_name} whispered \"{message}\" to {recipient_name}."
                    )),
                );
            }
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
        let Some(player) = self.player_list.get(player_index) else {
            return;
        };
        if !player.is_alive || player.roleblocked {
            return;
        }
        let role = player.role.kind;
        let persistent_target = player.persistent_target;
        match self.time {
            RoomPhase::Day
                if matches!(role, RoleKind::Tapper | RoleKind::Jailor)
                    && recipient != Some(player_index) =>
            {
                if let Some(p) = self.player_list.get_mut(player_index) {
                    p.day_target = recipient;
                }
            }
            RoomPhase::Night
                if matches!(role, RoleKind::Nimby | RoleKind::Vetter)
                    && recipient == Some(player_index) =>
            {
                if let Some(p) = self.player_list.get_mut(player_index) {
                    p.night_target = recipient;
                }
            }
            RoomPhase::Night if role == RoleKind::Jailor && recipient == Some(player_index) => {
                if let Some(p) = self.player_list.get_mut(player_index) {
                    p.night_target = persistent_target;
                }
            }
            RoomPhase::Night
                if !matches!(
                    role,
                    RoleKind::Mafia | RoleKind::Confesser | RoleKind::Framer
                ) && recipient != Some(player_index) =>
            {
                if let Some(p) = self.player_list.get_mut(player_index) {
                    p.night_target = recipient;
                }
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
            if player.role.kind == RoleKind::Framer
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
        if let [sole_leader] = leaders.as_slice() {
            Some(*sole_leader)
        } else {
            None
        }
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

pub fn load_room_fixture(
    path: &std::path::Path,
) -> Result<RoomReplayFixture, Box<dyn std::error::Error>> {
    let contents = std::fs::read_to_string(path)?;
    let fixture = serde_json::from_str(&contents)?;
    Ok(fixture)
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use crate::{
        protocol::{DayTime, JoinRoomResult, JoinRoomResultCode, ServerEvent},
        roles::{MAFIA_ROLES, NEUTRAL_ROLES, RoleDefinition, RoleKind, TOWN_ROLES},
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
            .unwrap_or(RoleDefinition {
                kind: RoleKind::Doctor,
                name: "Doctor",
                faction: Faction::Town,
                power: 5,
                unique: false,
                base_defence: CombatLevel::None,
            })
    }

    fn assign(room: &mut Room, index: usize, name: &str) {
        let Some(player) = room.player_list.get_mut(index) else {
            return;
        };
        player.role = role(name);
        player.defence = player.role.base_defence;
        player.defence_bonus = CombatLevel::None;
        player.persistent_target = None;
        player.night_target = None;
        player.day_target = None;
        player.faction_vote_target = None;
        player.visitors.clear();
        player.attackers.clear();
        player.insane = false;
        player.jailed_by = None;
        player.day_tapped_by = None;
        player.night_tapped_by = None;
        player.victory_condition = false;
        player.charges = if matches!(name, "Nimby" | "Vetter") {
            3
        } else {
            0
        };
    }

    #[test]
    fn room_lifecycle_fixture_replays_against_rust_room() -> Result<(), Box<dyn std::error::Error>>
    {
        let fixture_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../shared/gameplay-fixtures/room/lobby-lifecycle.json");
        let fixture = load_room_fixture(&fixture_path)?;

        let mut room = Room::new(fixture.room_size, fixture.room_name.clone());
        let join_results = fixture
            .actions
            .iter()
            .filter_map(|action| room.apply_action(action))
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
        Ok(())
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
        assert_eq!(
            room.player_list.get(1).map(|p| p.damage),
            Some(CombatLevel::Fatal)
        );
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
        assert_eq!(room.emissions.first().map(|e| e.target.as_str()), Some("a"));
        assert_eq!(
            room.emissions
                .first()
                .and_then(|e| e.message_key.as_deref()),
            Some("cannot_vote_yourself")
        );
        room.drain_emissions();
        room.handle_vote("a", 2, DayTime::Day);
        room.handle_vote("a", 1, DayTime::Day);
        room.handle_vote("b", 2, DayTime::Day);
        assert_eq!(room.player_list.get(2).map(|p| p.votes_received), Some(2));
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
        assert_eq!(room.player_list.first().map(|p| p.has_voted), Some(false));
        assert_eq!(room.player_list.first().and_then(|p| p.day_target), None);
        assert_eq!(room.player_list.first().and_then(|p| p.night_target), None);
        assert!(room.emissions.is_empty());
    }

    #[test]
    fn whisper_is_delivered_only_to_sender_and_recipient() {
        let mut room = started_room();
        room.handle_whisper("a", 1, "secret", DayTime::Day);
        assert_eq!(room.emissions.len(), 2);
        assert_eq!(room.emissions.first().map(|e| e.target.as_str()), Some("b"));
        assert_eq!(room.emissions.get(1).map(|e| e.target.as_str()), Some("a"));
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
        if let Some(player0) = room.player_list.get_mut(0) {
            player0.has_voted = true;
            player0.night_target = Some(1);
            player0.damage = CombatLevel::High;
        }
        if let Some(player1) = room.player_list.get_mut(1) {
            player1.abandoned = true;
        }
        room.start_night();
        assert_eq!(room.player_list.first().map(|p| p.has_voted), Some(false));
        assert_eq!(room.player_list.first().and_then(|p| p.night_target), None);
        assert_eq!(
            room.player_list.first().map(|p| p.damage),
            Some(CombatLevel::None)
        );
        assert_eq!(
            room.player_list.get(1).map(|p| p.damage),
            Some(CombatLevel::Fatal)
        );
    }

    #[test]
    fn tied_day_vote_does_not_eliminate_and_advances_to_night() {
        let mut room = started_room();
        assign(&mut room, 0, "Doctor");
        assign(&mut room, 1, "Mafia");
        assign(&mut room, 2, "Sniper");
        if let Some(p0) = room.player_list.get_mut(0) {
            p0.votes_received = 2;
        }
        if let Some(p1) = room.player_list.get_mut(1) {
            p1.votes_received = 2;
        }
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
        if let Some(p1) = room.player_list.get_mut(1) {
            p1.votes_received = 2;
        }
        room.finish_day();
        assert!(room.player_list.get(1).is_some_and(|p| !p.is_alive));
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
        assert!(room.player_list.get(2).is_some_and(|p| p.is_alive));
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
        assert!(room.player_list.first().is_some_and(|p| p.roleblocked));
        assert!(room.player_list.get(1).is_some_and(|p| !p.is_alive));
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
        assert_eq!(
            room.player_list.get(2).and_then(|p| p.faction_vote_target),
            None
        );
        assert_eq!(
            room.player_list.first().and_then(|p| p.faction_vote_target),
            None
        );
        room.handle_vote("a", 2, DayTime::Night);
        assert_eq!(
            room.player_list.first().and_then(|p| p.faction_vote_target),
            Some(2)
        );
    }

    #[test]
    fn high_attack_kills_low_defence_and_announces_winner() {
        let mut room = started_room();
        assign(&mut room, 0, "Sniper");
        assign(&mut room, 1, "Confesser");
        assign(&mut room, 2, "Doctor");
        if let Some(p1) = room.player_list.get_mut(1) {
            p1.is_alive = false;
        }
        room.start_night();
        room.handle_visit("a", Some(2), DayTime::Night);
        room.finish_night();
        assert!(room.player_list.get(2).is_some_and(|p| !p.is_alive));
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
        assert!(room.player_list.first().is_some_and(|p| !p.is_alive));
        assert!(room.emissions.iter().any(|event| {
            event.target == "a" && event.message_key.as_deref() == Some("you_have_died")
        }));
    }

    #[test]
    fn dead_and_night_players_cannot_use_public_chat() {
        let mut room = started_room();
        if let Some(p0) = room.player_list.get_mut(0) {
            p0.is_alive = false;
        }
        room.handle_message("a", "boo", DayTime::Day);
        assert_eq!(
            room.emissions
                .first()
                .and_then(|e| e.message_key.as_deref()),
            Some("cannot_speak_you_are_dead")
        );
        room.drain_emissions();
        if let Some(p0) = room.player_list.get_mut(0) {
            p0.is_alive = true;
        }
        room.start_night();
        room.drain_emissions();
        room.handle_message("a", "hello", DayTime::Night);
        assert_eq!(
            room.emissions
                .first()
                .and_then(|e| e.message_key.as_deref()),
            Some("cannot_speak_at_night")
        );
    }

    #[test]
    fn invalid_visit_targets_never_mutate_selected_target() {
        let mut room = started_room();
        room.handle_visit("a", Some(99), DayTime::Day);
        assert_eq!(room.player_list.first().and_then(|p| p.day_target), None);
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
        if let Some(p1) = room.player_list.get_mut(1) {
            p1.is_alive = false;
        }
        assert!(room.finish_if_winner());
        assert_eq!(
            room.player_list.first().map(|p| p.role.faction),
            Some(Faction::Town)
        );
    }

    #[test]
    fn framer_tracks_a_living_town_target_and_wins_on_vote_out() {
        let mut room = started_room();
        assign(&mut room, 0, "Framer");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.refresh_framer_targets();
        assert_eq!(
            room.player_list.first().and_then(|p| p.persistent_target),
            Some(1)
        );
        if let Some(p1) = room.player_list.get_mut(1) {
            p1.votes_received = 2;
        }
        room.finish_day();
        assert!(
            room.player_list
                .first()
                .is_some_and(|p| p.victory_condition)
        );
    }

    #[test]
    fn confesser_vote_out_wins_and_disables_future_voting() {
        let mut room = started_room();
        assign(&mut room, 0, "Confesser");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        if let Some(p0) = room.player_list.get_mut(0) {
            p0.votes_received = 2;
        }
        room.finish_day();
        assert!(room.voting_disabled);
        assert!(
            room.player_list
                .first()
                .is_some_and(|p| p.victory_condition)
        );
        room.start_day(2);
        room.drain_emissions();
        room.handle_vote("b", 2, DayTime::Day);
        assert_eq!(room.player_list.get(2).map(|p| p.votes_received), Some(0));
    }

    #[test]
    fn peacemaker_wins_the_configured_no_death_draw() {
        let mut room = started_room();
        assign(&mut room, 0, "Peacemaker");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.start_day(3);
        assert!(room.game_has_ended);
        assert!(
            room.player_list
                .first()
                .is_some_and(|p| p.victory_condition)
        );
    }

    #[test]
    fn jailor_jails_by_day_executes_at_night_and_private_chat_routes() {
        let mut room = started_room();
        assign(&mut room, 0, "Jailor");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.handle_visit("a", Some(1), DayTime::Day);
        room.finish_day();
        assert_eq!(room.player_list.get(1).and_then(|p| p.jailed_by), Some(0));
        room.drain_emissions();
        room.handle_message("b", "help", DayTime::Night);
        assert!(
            room.emissions
                .iter()
                .any(|e| e.target == "a" && e.event == ServerEvent::ReceiveChatMessage.as_str())
        );
        room.handle_visit("a", Some(0), DayTime::Night);
        room.finish_night();
        assert!(room.player_list.get(1).is_some_and(|p| !p.is_alive));
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
            assert_eq!(
                room.player_list.first().map(|p| p.charges),
                Some(2),
                "{name}"
            );
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
        assert!(room.emissions.iter().any(|e| {
            e.target == "a"
                && e.args
                    .first()
                    .and_then(|v| v.as_str())
                    .is_some_and(|s| s.contains("secret"))
        }));
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
        assert!(room.player_list.first().is_some_and(|p| p.insane));

        let mut room = started_room();
        assign(&mut room, 0, "Sacrificer");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.start_night();
        room.handle_visit("a", Some(1), DayTime::Night);
        room.handle_vote("c", 1, DayTime::Night);
        room.resolve_night_actions();
        assert_eq!(
            room.player_list.first().map(|p| p.damage),
            Some(CombatLevel::Critical)
        );
        assert_eq!(
            room.player_list.get(1).map(|p| p.defence),
            Some(CombatLevel::High)
        );

        let mut room = started_room();
        assign(&mut room, 0, "Sniper");
        assign(&mut room, 1, "Doctor");
        assign(&mut room, 2, "Mafia");
        room.start_night();
        room.handle_visit("a", Some(1), DayTime::Night);
        room.resolve_night_actions();
        assert_eq!(
            room.player_list.get(1).map(|p| p.damage),
            Some(CombatLevel::High)
        );
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
                assert_eq!(
                    room.player_list.first().and_then(|p| p.faction_vote_target),
                    Some(1)
                );
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
                assert_eq!(
                    room.player_list.first().and_then(|p| p.night_target),
                    Some(1)
                );
            }
            "Bodyguard" | "Doctor" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.resolve_night_actions();
                assert!(
                    room.player_list
                        .get(1)
                        .is_some_and(|p| p.defence >= CombatLevel::Low)
                );
            }
            "Fortifier" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.resolve_night_actions();
                assert_eq!(
                    room.player_list.first().and_then(|p| p.persistent_target),
                    Some(1)
                );
                assert_eq!(
                    room.player_list.get(1).map(|p| p.defence_bonus),
                    Some(CombatLevel::Medium)
                );
            }
            "Jailor" => {
                room.handle_visit("socket-0", Some(1), DayTime::Day);
                room.resolve_day_actions();
                assert_eq!(room.player_list.get(1).and_then(|p| p.jailed_by), Some(0));
            }
            "Lawman" | "Maniac" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.resolve_night_actions();
                assert!(
                    room.player_list
                        .get(1)
                        .is_some_and(|p| p.damage >= CombatLevel::Low)
                );
            }
            "Nimby" | "Vetter" => {
                room.start_night();
                room.handle_visit("socket-0", Some(0), DayTime::Night);
                room.resolve_night_actions();
                assert_eq!(room.player_list.first().map(|p| p.charges), Some(2));
            }
            "Sacrificer" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.handle_vote("socket-2", 1, DayTime::Night);
                room.resolve_night_actions();
                assert_eq!(
                    room.player_list.first().map(|p| p.damage),
                    Some(CombatLevel::Critical)
                );
            }
            "Tapper" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.resolve_night_actions();
                assert_eq!(
                    room.player_list.get(1).and_then(|p| p.day_tapped_by),
                    Some(0)
                );
            }
            "Confesser" => {
                if let Some(p0) = room.player_list.get_mut(0) {
                    p0.votes_received = 2;
                }
                room.finish_day();
                assert!(
                    room.player_list
                        .first()
                        .is_some_and(|p| p.victory_condition)
                        && room.voting_disabled
                );
            }
            "Framer" => {
                room.refresh_framer_targets();
                assert!(
                    room.player_list
                        .first()
                        .and_then(|p| p.persistent_target)
                        .is_some()
                );
            }
            "Sniper" => {
                room.start_night();
                room.handle_visit("socket-0", Some(1), DayTime::Night);
                room.resolve_night_actions();
                assert_eq!(
                    room.player_list.get(1).map(|p| p.damage),
                    Some(CombatLevel::High)
                );
            }
            _ => {}
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
        assert!(room.player_list.get(2).is_some_and(|p| p.is_alive));
        assert_eq!(room.time, super::RoomPhase::Day);
        for voter in 1..4 {
            room.handle_vote(&format!("socket-{voter}"), 0, DayTime::Day);
        }
        room.finish_day();
        assert!(room.player_list.first().is_some_and(|p| !p.is_alive));
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
        assert!(
            room.player_list
                .first()
                .is_some_and(|p| p.victory_condition)
        );
    }
}
