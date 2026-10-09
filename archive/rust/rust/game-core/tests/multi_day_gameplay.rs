use game_core::{protocol::DayTime, room::RoomPhase, testing::MockGame};
use serde_json::Value;

#[test]
fn town_wins_after_three_days_with_protection_deaths_and_changing_quorum()
-> Result<(), Box<dyn std::error::Error>> {
    let mut game = MockGame::with_roles(
        "multi-day-integration",
        &[
            "Mafia",
            "Mafia Investigator",
            "Doctor",
            "Investigator",
            "Judge",
        ],
    )?;

    // Day 1: no consensus. At night the Doctor saves the Mafia target.
    game.finish_day();
    assert_eq!(game.room.time, RoomPhase::Night);
    game.vote(0, 3, DayTime::Night);
    game.vote(1, 3, DayTime::Night);
    game.visit(2, Some(3), DayTime::Night);
    game.finish_night();
    assert_eq!(game.room.day_number, 2);
    assert!(game.player(3).is_some_and(|p| p.is_alive));

    // Day 2: Town eliminates one Mafia member at the five-player quorum.
    game.vote(0, 1, DayTime::Day);
    game.vote(2, 1, DayTime::Day);
    game.vote(3, 1, DayTime::Day);
    game.finish_day();
    assert!(game.player(1).is_some_and(|p| !p.is_alive));
    assert!(!game.room.game_has_ended);

    // Night 2: the remaining Mafia member kills the unprotected Judge.
    game.vote(0, 4, DayTime::Night);
    game.finish_night();
    assert_eq!(game.room.day_number, 3);
    assert!(game.player(4).is_some_and(|p| !p.is_alive));

    // Day 3: quorum has fallen to two; Town eliminates the last Mafia member.
    game.vote(2, 0, DayTime::Day);
    game.vote(3, 0, DayTime::Day);
    game.finish_day();
    assert!(game.player(0).is_some_and(|p| !p.is_alive));
    assert!(game.room.game_has_ended);
    assert!(game.room.emissions.iter().any(|event| {
        event.message_key.as_deref() == Some("faction_won")
            && event
                .args
                .first()
                .and_then(|arg| arg.get("params"))
                .and_then(|p| p.get("factionName"))
                .and_then(Value::as_str)
                == Some("town")
    }));
    Ok(())
}

#[test]
fn mafia_wins_after_roleblocking_protection_across_three_days()
-> Result<(), Box<dyn std::error::Error>> {
    let mut game = MockGame::with_roles(
        "multi-day-integration",
        &[
            "Mafia",
            "Mafia Roleblocker",
            "Doctor",
            "Investigator",
            "Judge",
        ],
    )?;

    // Night 1: the roleblocker prevents the Doctor saving the Investigator.
    game.finish_day();
    game.vote(0, 3, DayTime::Night);
    game.vote(1, 3, DayTime::Night);
    game.visit(1, Some(2), DayTime::Night);
    game.visit(2, Some(3), DayTime::Night);
    game.finish_night();
    assert_eq!(game.room.day_number, 2);
    assert!(game.player(3).is_some_and(|p| !p.is_alive));
    assert!(game.player(2).is_some_and(|p| p.roleblocked));

    // Day 2 has no elimination. Mafia repeats the block-and-kill combination.
    game.finish_day();
    game.vote(0, 4, DayTime::Night);
    game.vote(1, 4, DayTime::Night);
    game.visit(1, Some(2), DayTime::Night);
    game.visit(2, Some(4), DayTime::Night);
    game.finish_night();
    assert_eq!(game.room.day_number, 3);
    assert!(game.player(4).is_some_and(|p| !p.is_alive));

    // Day 3: both Mafia members form the reduced quorum against the Doctor.
    game.vote(0, 2, DayTime::Day);
    game.vote(1, 2, DayTime::Day);
    game.finish_day();
    assert!(game.player(2).is_some_and(|p| !p.is_alive));
    assert!(game.room.game_has_ended);
    assert!(game.room.emissions.iter().any(|event| {
        event.message_key.as_deref() == Some("faction_won")
            && event
                .args
                .first()
                .and_then(|arg| arg.get("params"))
                .and_then(|p| p.get("factionName"))
                .and_then(Value::as_str)
                == Some("mafia")
    }));
    Ok(())
}

#[test]
fn no_death_game_runs_all_scheduled_phases_before_draw() -> Result<(), Box<dyn std::error::Error>> {
    let mut game =
        MockGame::with_roles("multi-day-integration", &["Peacemaker", "Doctor", "Mafia"])?;

    game.finish_day();
    assert_eq!(game.room.time, RoomPhase::Night);
    game.finish_night();
    assert_eq!((game.room.day_number, game.room.time), (2, RoomPhase::Day));

    game.finish_day();
    game.finish_night();
    assert_eq!(game.room.day_number, 2);
    assert!(game.room.game_has_ended);
    assert!(game.player(0).is_some_and(|p| p.victory_condition));
    assert!(game.has_message("game_ended_nobody_died"));
    Ok(())
}
