use serde::Serialize;

use crate::{room::CombatLevel, systems::Faction};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleDefinition {
    pub name: &'static str,
    pub faction: Faction,
    pub power: i16,
    pub unique: bool,
    pub base_defence: CombatLevel,
}

const fn role(
    name: &'static str,
    faction: Faction,
    power: i16,
    unique: bool,
    base_defence: CombatLevel,
) -> RoleDefinition {
    RoleDefinition {
        name,
        faction,
        power,
        unique,
        base_defence,
    }
}

pub const TOWN_ROLES: &[RoleDefinition] = &[
    role("Bodyguard", Faction::Town, 6, false, CombatLevel::None),
    role("Doctor", Faction::Town, 5, false, CombatLevel::None),
    role("Fortifier", Faction::Town, 8, false, CombatLevel::None),
    role("Investigator", Faction::Town, 4, false, CombatLevel::None),
    role("Jailor", Faction::Town, 12, true, CombatLevel::None),
    role("Judge", Faction::Town, 6, false, CombatLevel::None),
    role("Lawman", Faction::Town, 8, true, CombatLevel::None),
    role("Nimby", Faction::Town, 5, false, CombatLevel::None),
    role("Roleblocker", Faction::Town, 5, false, CombatLevel::None),
    role("Sacrificer", Faction::Town, 8, false, CombatLevel::None),
    role("Tapper", Faction::Town, 3, false, CombatLevel::None),
    role("Tracker", Faction::Town, 5, false, CombatLevel::None),
    role("Vetter", Faction::Town, 4, false, CombatLevel::None),
    role("Watchman", Faction::Town, 4, false, CombatLevel::None),
];

pub const MAFIA_ROLES: &[RoleDefinition] = &[
    role("Mafia", Faction::Mafia, -13, false, CombatLevel::None),
    role(
        "Mafia Investigator",
        Faction::Mafia,
        -15,
        false,
        CombatLevel::None,
    ),
    role(
        "Mafia Roleblocker",
        Faction::Mafia,
        -20,
        false,
        CombatLevel::None,
    ),
];

pub const NEUTRAL_ROLES: &[RoleDefinition] = &[
    role("Confesser", Faction::Neutral, -5, true, CombatLevel::Low),
    role("Framer", Faction::Neutral, -5, true, CombatLevel::Low),
    role("Maniac", Faction::Maniac, -12, true, CombatLevel::Low),
    role("Peacemaker", Faction::Neutral, -2, true, CombatLevel::None),
    role("Sniper", Faction::Sniper, -10, true, CombatLevel::Low),
];

pub fn assign_roles(count: usize, mut random: impl FnMut() -> f64) -> Vec<RoleDefinition> {
    let mut town = TOWN_ROLES.to_vec();
    let mut mafia = MAFIA_ROLES.to_vec();
    let mut neutral = NEUTRAL_ROLES.to_vec();
    let mut result = Vec::with_capacity(count);
    let mut power = 0_i16;
    for _ in 0..count {
        let offset = random() * 30.0 - 15.0;
        let source = if (-14..=14).contains(&power) {
            if offset > f64::from(power) {
                &mut town
            } else if random() > 0.3 || neutral.is_empty() {
                &mut mafia
            } else {
                &mut neutral
            }
        } else if power >= 15 {
            &mut mafia
        } else {
            &mut town
        };
        if source.is_empty() {
            continue;
        }
        let index = ((random() * source.len() as f64).floor() as usize).min(source.len() - 1);
        let chosen = source[index];
        result.push(chosen);
        power += chosen.power;
        if chosen.unique {
            source.remove(index);
        }
    }
    result
}

pub fn shuffle_roles(roles: &mut [RoleDefinition], mut random: impl FnMut() -> f64) {
    let mut current = roles.len();
    while current != 0 {
        let index = ((random() * current as f64).floor() as usize).min(current - 1);
        current -= 1;
        roles.swap(current, index);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn catalog_contains_every_typescript_builtin_role() {
        assert_eq!(TOWN_ROLES.len(), 14);
        assert_eq!(MAFIA_ROLES.len(), 3);
        assert_eq!(NEUTRAL_ROLES.len(), 5);
    }

    #[test]
    fn assignment_is_deterministic_and_never_duplicates_unique_roles() {
        let values = [0.9, 0.1, 0.4, 0.1, 0.8, 0.2, 0.6, 0.1, 0.3, 0.7];
        let mut cursor = 0;
        let roles = assign_roles(8, || {
            let value = values[cursor % values.len()];
            cursor += 1;
            value
        });
        assert_eq!(roles.len(), 8);
        let unique = roles
            .iter()
            .filter(|role| role.unique)
            .map(|role| role.name)
            .collect::<Vec<_>>();
        assert_eq!(
            unique.iter().copied().collect::<HashSet<_>>().len(),
            unique.len()
        );
    }

    #[test]
    fn every_supported_room_size_receives_exactly_one_role_per_player() {
        for count in 1..=20 {
            for random in [0.0, 0.25, 0.5, 0.75, 0.999_999] {
                let roles = assign_roles(count, || random);
                assert_eq!(roles.len(), count, "count={count}, random={random}");
                assert!(roles.iter().all(|assigned| {
                    TOWN_ROLES
                        .iter()
                        .chain(MAFIA_ROLES)
                        .chain(NEUTRAL_ROLES)
                        .any(|catalog_role| catalog_role == assigned)
                }));
            }
        }
    }

    #[test]
    fn shuffle_preserves_the_role_multiset_at_random_boundaries() {
        let original = TOWN_ROLES[..8].to_vec();
        for random in [0.0, 0.5, 0.999_999] {
            let mut shuffled = original.clone();
            shuffle_roles(&mut shuffled, || random);
            let mut names = shuffled.iter().map(|role| role.name).collect::<Vec<_>>();
            let mut expected = original.iter().map(|role| role.name).collect::<Vec<_>>();
            names.sort_unstable();
            expected.sort_unstable();
            assert_eq!(names, expected);
        }
    }
}
