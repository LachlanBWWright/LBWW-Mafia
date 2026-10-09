use rand::{Rng, SeedableRng, rngs::StdRng};

use crate::{
    roles::{RoleSelectionConfig, assign_roles, select_roles, shuffle_roles},
    room::{CombatLevel, Player, User},
};

pub fn assign_players(users: &[User], selection: &RoleSelectionConfig, seed: u64) -> Vec<Player> {
    let mut rng = StdRng::seed_from_u64(seed);
    let mut roles = if *selection == RoleSelectionConfig::default() {
        assign_roles(users.len(), || rng.random::<f64>())
    } else {
        select_roles(users.len(), selection, || rng.random::<f64>())
            .unwrap_or_else(|_| assign_roles(users.len(), || rng.random::<f64>()))
    };
    shuffle_roles(&mut roles, || rng.random::<f64>());
    users
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
        .collect()
}
