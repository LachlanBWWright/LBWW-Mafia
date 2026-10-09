use game_core::{protocol::DayTime, room::RoomPhase, testing::MockGame};

const FIFTEEN_PLAYER_ROLES: [&str; 15] = [
    "Mafia",
    "Mafia Investigator",
    "Mafia Roleblocker",
    "Doctor",
    "Bodyguard",
    "Investigator",
    "Jailor",
    "Judge",
    "Lawman",
    "Nimby",
    "Roleblocker",
    "Tapper",
    "Tracker",
    "Vetter",
    "Watchman",
];

fn new_long_game() -> Result<MockGame, Box<dyn std::error::Error>> {
    Ok(MockGame::with_roles(
        "long-mock-game",
        &FIFTEEN_PLAYER_ROLES,
    )?)
}

#[test]
fn fifteen_players_survive_eight_days_of_mixed_actions() -> Result<(), Box<dyn std::error::Error>> {
    let mut game = new_long_game()?;
    let doctor = game.role_index("Doctor").ok_or("doctor missing")?;
    let mafia = [0, 1, 2];
    let mut deaths = 0;

    for day in 1..=8 {
        assert!(!game.room.game_has_ended, "game ended before day {day}");
        assert_eq!(game.room.time, RoomPhase::Day);
        assert_eq!(game.room.day_number, day);

        let alive = game.alive_indices();
        assert!(alive.len() >= 8, "too many players died before day {day}");

        // Split the living players between two targets. The split remains
        // below the majority threshold while the room's vote path is used.
        let first_target = *alive.first().ok_or("no living players")?;
        let second_target = *alive.get(1).ok_or("fewer than two living players")?;
        for (offset, voter) in alive.iter().enumerate() {
            let target = if offset % 2 == 0 {
                first_target
            } else {
                second_target
            };
            game.vote(*voter, target, DayTime::Day);
        }
        game.chat(0, &format!("day {day} public message"), DayTime::Day);
        game.whisper(1, first_target, &format!("day {day} whisper"), DayTime::Day);
        game.finish_day();
        assert!(
            !game.room.game_has_ended,
            "day vote ended the game on day {day}"
        );
        assert_eq!(game.room.time, RoomPhase::Night);

        let target = game
            .alive_indices()
            .into_iter()
            .find(|index| !mafia.contains(index))
            .ok_or("no living town target")?;

        // All mafia members coordinate on one target. The Mafia Roleblocker
        // blocks the Doctor, so this deliberately exercises both faction
        // voting and roleblock ordering on every night.
        for voter in mafia {
            game.vote(voter, target, DayTime::Night);
        }
        game.visit(2, Some(doctor), DayTime::Night);
        if game.player(doctor).is_some_and(|player| player.is_alive) {
            game.visit(doctor, Some(target), DayTime::Night);
        }
        game.finish_night();

        let current_deaths = FIFTEEN_PLAYER_ROLES.len() - game.alive_count();
        assert!(
            current_deaths >= deaths,
            "alive count increased on day {day}"
        );
        deaths = current_deaths;
        assert!(game.has_event("update-day-time"));
    }

    assert_eq!(game.room.day_number, 9);
    assert_eq!(deaths, 8);
    assert!(!game.room.game_has_ended);
    assert!(game.has_event("receive-chat-message"));
    assert!(game.has_event("receive-whisper-message"));
    Ok(())
}

#[test]
fn fifteen_player_no_death_game_reaches_a_late_peacemaker_draw()
-> Result<(), Box<dyn std::error::Error>> {
    let mut game = MockGame::with_roles(
        "long-no-death-game",
        &[
            "Peacemaker",
            "Mafia",
            "Mafia Investigator",
            "Mafia Roleblocker",
            "Doctor",
            "Bodyguard",
            "Investigator",
            "Jailor",
            "Judge",
            "Lawman",
            "Nimby",
            "Roleblocker",
            "Tapper",
            "Tracker",
            "Watchman",
        ],
    )?;
    // The normal room threshold is three days. Extending it makes the test
    // exercise repeated empty day/night transitions before the draw.
    game.room.no_death_end_day = 9;

    for day in 1..=8 {
        assert!(
            !game.room.game_has_ended,
            "draw happened too early on day {day}"
        );
        assert_eq!(game.room.time, RoomPhase::Day);
        game.chat(0, &format!("quiet day {day}"), DayTime::Day);
        game.finish_day();
        assert_eq!(game.room.time, RoomPhase::Night);

        // Invalid and empty night actions must not manufacture a death.
        game.vote(4, 0, DayTime::Night);
        game.visit(3, Some(4), DayTime::Night);
        game.visit(4, None, DayTime::Night);
        game.finish_night();
    }

    assert!(game.room.game_has_ended);
    assert_eq!(game.room.day_number, 8);
    assert_eq!(game.alive_count(), 15);
    assert!(
        game.player(0)
            .is_some_and(|player| player.victory_condition)
    );
    assert!(game.has_message("game_ended_nobody_died"));
    assert!(!game.drain_events().is_empty());
    Ok(())
}

#[test]
fn fifteen_player_replay_keeps_invalid_actions_harmless_over_eight_days()
-> Result<(), Box<dyn std::error::Error>> {
    let mut game = new_long_game()?;
    game.room.no_death_end_day = 99;
    let initial_state = game.room.clone();

    for _ in 0..8 {
        // Wrong-phase and invalid-recipient actions are repeatedly submitted
        // before the legitimate phase transition.
        game.vote(0, 99, DayTime::Night);
        game.visit(0, Some(99), DayTime::Day);
        game.chat(99, "not a real player", DayTime::Day);
        game.finish_day();
        game.vote(0, 99, DayTime::Day);
        game.visit(0, Some(99), DayTime::Night);
        game.finish_night();
        if game.room.game_has_ended {
            break;
        }
    }

    assert!(game.room.day_number >= 8);
    assert!(game.room.user_list.iter().all(|user| {
        initial_state
            .user_list
            .iter()
            .any(|before| before.socket_id == user.socket_id)
    }));
    assert!(game.room.player_list.iter().all(|player| {
        player.votes_received <= game.room.player_list.len()
            && player
                .visitors
                .iter()
                .all(|visitor| *visitor < game.room.player_list.len())
    }));
    Ok(())
}
