use game_core::{
    protocol::DayTime,
    roles::{MAFIA_ROLES, NEUTRAL_ROLES, RoleDefinition, TOWN_ROLES},
    room::{CombatLevel, Room, RoomPhase},
};
use serde_json::Value;

fn role(name: &str) -> Option<RoleDefinition> {
    TOWN_ROLES
        .iter()
        .chain(MAFIA_ROLES)
        .chain(NEUTRAL_ROLES)
        .find(|role| role.name == name)
        .copied()
}

fn game_with_roles(names: &[&str]) -> Room {
    let mut room = Room::new(names.len(), "multi-day-integration");
    for index in 0..names.len() {
        room.add_user(format!("player-{index}"));
    }
    for (index, name) in names.iter().enumerate() {
        let Some(definition) = role(name) else {
            continue;
        };
        let Some(player) = room.player_list.get_mut(index) else {
            continue;
        };
        player.role = definition;
        player.defence = definition.base_defence;
        player.defence_bonus = CombatLevel::None;
        player.charges = definition.kind.starting_charges();
        player.persistent_target = None;
        player.day_target = None;
        player.night_target = None;
        player.faction_vote_target = None;
        player.visitors.clear();
        player.attackers.clear();
        player.roleblocked = false;
        player.victory_condition = false;
    }
    room.drain_emissions();
    room
}

fn vote(room: &mut Room, voter: usize, target: usize) {
    room.handle_vote(&format!("player-{voter}"), target, DayTime::Day);
}

fn night_vote(room: &mut Room, voter: usize, target: usize) {
    room.handle_vote(&format!("player-{voter}"), target, DayTime::Night);
}

fn visit(room: &mut Room, actor: usize, target: usize) {
    room.handle_visit(&format!("player-{actor}"), Some(target), DayTime::Night);
}

#[test]
fn town_wins_after_three_days_with_protection_deaths_and_changing_quorum() {
    let mut room = game_with_roles(&[
        "Mafia",
        "Mafia Investigator",
        "Doctor",
        "Investigator",
        "Judge",
    ]);

    // Day 1: no consensus. At night the Doctor saves the Mafia target.
    room.finish_day();
    assert_eq!(room.time, RoomPhase::Night);
    night_vote(&mut room, 0, 3);
    night_vote(&mut room, 1, 3);
    visit(&mut room, 2, 3);
    room.finish_night();
    assert_eq!(room.day_number, 2);
    assert!(room.player_list.get(3).is_some_and(|p| p.is_alive));

    // Day 2: Town eliminates one Mafia member at the five-player quorum.
    vote(&mut room, 0, 1);
    vote(&mut room, 2, 1);
    vote(&mut room, 3, 1);
    room.finish_day();
    assert!(room.player_list.get(1).is_some_and(|p| !p.is_alive));
    assert!(!room.game_has_ended);

    // Night 2: the remaining Mafia member kills the unprotected Judge.
    night_vote(&mut room, 0, 4);
    room.finish_night();
    assert_eq!(room.day_number, 3);
    assert!(room.player_list.get(4).is_some_and(|p| !p.is_alive));

    // Day 3: quorum has fallen to two; Town eliminates the last Mafia member.
    vote(&mut room, 2, 0);
    vote(&mut room, 3, 0);
    room.finish_day();
    assert!(room.player_list.first().is_some_and(|p| !p.is_alive));
    assert!(room.game_has_ended);
    assert!(room.emissions.iter().any(|event| {
        event.message_key.as_deref() == Some("faction_won")
            && event
                .args
                .first()
                .and_then(|arg| arg.get("params"))
                .and_then(|p| p.get("factionName"))
                .and_then(Value::as_str)
                == Some("town")
    }));
}

#[test]
fn mafia_wins_after_roleblocking_protection_across_three_days() {
    let mut room = game_with_roles(&[
        "Mafia",
        "Mafia Roleblocker",
        "Doctor",
        "Investigator",
        "Judge",
    ]);

    // Night 1: the roleblocker prevents the Doctor saving the Investigator.
    room.finish_day();
    night_vote(&mut room, 0, 3);
    night_vote(&mut room, 1, 3);
    visit(&mut room, 1, 2);
    visit(&mut room, 2, 3);
    room.finish_night();
    assert_eq!(room.day_number, 2);
    assert!(room.player_list.get(3).is_some_and(|p| !p.is_alive));
    assert!(room.player_list.get(2).is_some_and(|p| p.roleblocked));

    // Day 2 has no elimination. Mafia repeats the block-and-kill combination.
    room.finish_day();
    night_vote(&mut room, 0, 4);
    night_vote(&mut room, 1, 4);
    visit(&mut room, 1, 2);
    visit(&mut room, 2, 4);
    room.finish_night();
    assert_eq!(room.day_number, 3);
    assert!(room.player_list.get(4).is_some_and(|p| !p.is_alive));

    // Day 3: both Mafia members form the reduced quorum against the Doctor.
    vote(&mut room, 0, 2);
    vote(&mut room, 1, 2);
    room.finish_day();
    assert!(room.player_list.get(2).is_some_and(|p| !p.is_alive));
    assert!(room.game_has_ended);
    assert!(room.emissions.iter().any(|event| {
        event.message_key.as_deref() == Some("faction_won")
            && event
                .args
                .first()
                .and_then(|arg| arg.get("params"))
                .and_then(|p| p.get("factionName"))
                .and_then(Value::as_str)
                == Some("mafia")
    }));
}

#[test]
fn no_death_game_runs_all_scheduled_phases_before_draw() {
    let mut room = game_with_roles(&["Peacemaker", "Doctor", "Mafia"]);

    room.finish_day();
    assert_eq!(room.time, RoomPhase::Night);
    room.finish_night();
    assert_eq!((room.day_number, room.time), (2, RoomPhase::Day));

    room.finish_day();
    room.finish_night();
    assert_eq!(room.day_number, 2);
    assert!(room.game_has_ended);
    assert!(
        room.player_list
            .first()
            .is_some_and(|p| p.victory_condition)
    );
    assert!(
        room.emissions
            .iter()
            .any(|event| { event.message_key.as_deref() == Some("game_ended_nobody_died") })
    );
}
