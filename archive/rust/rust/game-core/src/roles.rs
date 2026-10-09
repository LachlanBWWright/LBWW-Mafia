use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{room::CombatLevel, systems::Faction};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RoleKind {
    // Town
    Bodyguard,
    Doctor,
    Fortifier,
    Investigator,
    Jailor,
    Judge,
    Lawman,
    Nimby,
    Roleblocker,
    Sacrificer,
    Tapper,
    Tracker,
    Vetter,
    Watchman,

    // Mafia
    Mafia,
    MafiaInvestigator,
    MafiaRoleblocker,

    // Neutral
    Confesser,
    Framer,
    Maniac,
    Peacemaker,
    Sniper,
}

impl RoleKind {
    pub const fn name(&self) -> &'static str {
        match self {
            Self::Bodyguard => "Bodyguard",
            Self::Doctor => "Doctor",
            Self::Fortifier => "Fortifier",
            Self::Investigator => "Investigator",
            Self::Jailor => "Jailor",
            Self::Judge => "Judge",
            Self::Lawman => "Lawman",
            Self::Nimby => "Nimby",
            Self::Roleblocker => "Roleblocker",
            Self::Sacrificer => "Sacrificer",
            Self::Tapper => "Tapper",
            Self::Tracker => "Tracker",
            Self::Vetter => "Vetter",
            Self::Watchman => "Watchman",
            Self::Mafia => "Mafia",
            Self::MafiaInvestigator => "Mafia Investigator",
            Self::MafiaRoleblocker => "Mafia Roleblocker",
            Self::Confesser => "Confesser",
            Self::Framer => "Framer",
            Self::Maniac => "Maniac",
            Self::Peacemaker => "Peacemaker",
            Self::Sniper => "Sniper",
        }
    }

    pub const fn starting_charges(&self) -> u8 {
        match self {
            Self::Nimby | Self::Vetter => 3,
            _ => 0,
        }
    }

    pub const fn can_day_visit_others(&self) -> bool {
        matches!(self, Self::Tapper | Self::Jailor)
    }

    pub const fn can_night_visit_self(&self) -> bool {
        matches!(self, Self::Nimby | Self::Vetter | Self::Jailor)
    }

    pub const fn can_night_visit_others(&self) -> bool {
        !matches!(self, Self::Confesser)
    }
}

impl std::fmt::Display for RoleKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.name())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleDefinition {
    pub kind: RoleKind,
    pub name: &'static str,
    pub faction: Faction,
    pub power: i16,
    pub unique: bool,
    pub base_defence: CombatLevel,
}

const fn role(
    kind: RoleKind,
    faction: Faction,
    power: i16,
    unique: bool,
    base_defence: CombatLevel,
) -> RoleDefinition {
    RoleDefinition {
        kind,
        name: kind.name(),
        faction,
        power,
        unique,
        base_defence,
    }
}

pub const TOWN_ROLES: &[RoleDefinition] = &[
    role(
        RoleKind::Bodyguard,
        Faction::Town,
        6,
        false,
        CombatLevel::None,
    ),
    role(RoleKind::Doctor, Faction::Town, 5, false, CombatLevel::None),
    role(
        RoleKind::Fortifier,
        Faction::Town,
        8,
        false,
        CombatLevel::None,
    ),
    role(
        RoleKind::Investigator,
        Faction::Town,
        4,
        false,
        CombatLevel::None,
    ),
    role(RoleKind::Jailor, Faction::Town, 12, true, CombatLevel::None),
    role(RoleKind::Judge, Faction::Town, 6, false, CombatLevel::None),
    role(RoleKind::Lawman, Faction::Town, 8, true, CombatLevel::None),
    role(RoleKind::Nimby, Faction::Town, 5, false, CombatLevel::None),
    role(
        RoleKind::Roleblocker,
        Faction::Town,
        5,
        false,
        CombatLevel::None,
    ),
    role(
        RoleKind::Sacrificer,
        Faction::Town,
        8,
        false,
        CombatLevel::None,
    ),
    role(RoleKind::Tapper, Faction::Town, 3, false, CombatLevel::None),
    role(
        RoleKind::Tracker,
        Faction::Town,
        5,
        false,
        CombatLevel::None,
    ),
    role(RoleKind::Vetter, Faction::Town, 4, false, CombatLevel::None),
    role(
        RoleKind::Watchman,
        Faction::Town,
        4,
        false,
        CombatLevel::None,
    ),
];

pub const MAFIA_ROLES: &[RoleDefinition] = &[
    role(
        RoleKind::Mafia,
        Faction::Mafia,
        -13,
        false,
        CombatLevel::None,
    ),
    role(
        RoleKind::MafiaInvestigator,
        Faction::Mafia,
        -15,
        false,
        CombatLevel::None,
    ),
    role(
        RoleKind::MafiaRoleblocker,
        Faction::Mafia,
        -20,
        false,
        CombatLevel::None,
    ),
];

pub const NEUTRAL_ROLES: &[RoleDefinition] = &[
    role(
        RoleKind::Confesser,
        Faction::Neutral,
        -5,
        true,
        CombatLevel::Low,
    ),
    role(
        RoleKind::Framer,
        Faction::Neutral,
        -5,
        true,
        CombatLevel::Low,
    ),
    role(
        RoleKind::Maniac,
        Faction::Maniac,
        -12,
        true,
        CombatLevel::Low,
    ),
    role(
        RoleKind::Peacemaker,
        Faction::Neutral,
        -2,
        true,
        CombatLevel::None,
    ),
    role(
        RoleKind::Sniper,
        Faction::Sniper,
        -10,
        true,
        CombatLevel::Low,
    ),
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RoleSelectionAlgorithm {
    WeightedRandom,
    TierBalanced,
    ExplicitSlots,
}

impl Default for RoleSelectionAlgorithm {
    fn default() -> Self {
        Self::WeightedRandom
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleSelectionRule {
    pub role: RoleKind,
    #[serde(default = "default_weight")]
    pub weight: f64,
    #[serde(default)]
    pub minimum: usize,
    pub maximum: Option<usize>,
    pub tier: Option<u8>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TierTarget {
    pub tier: u8,
    #[serde(default)]
    pub minimum: usize,
    pub maximum: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FactionLimit {
    pub faction: Faction,
    #[serde(default)]
    pub minimum: usize,
    pub maximum: Option<usize>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleSelectionConfig {
    #[serde(default)]
    pub algorithm: RoleSelectionAlgorithm,
    #[serde(default)]
    pub roles: Vec<RoleSelectionRule>,
    #[serde(default)]
    pub tier_targets: Vec<TierTarget>,
    #[serde(default)]
    pub faction_limits: Vec<FactionLimit>,
    #[serde(default)]
    pub explicit_slots: Vec<RoleKind>,
}

impl Default for RoleSelectionConfig {
    fn default() -> Self {
        Self {
            algorithm: RoleSelectionAlgorithm::WeightedRandom,
            roles: Vec::new(),
            tier_targets: Vec::new(),
            faction_limits: Vec::new(),
            explicit_slots: Vec::new(),
        }
    }
}

fn default_weight() -> f64 {
    1.0
}

impl RoleDefinition {
    pub const fn default_tier(&self) -> u8 {
        if self.power.abs() >= 12 {
            3
        } else if self.power.abs() >= 7 {
            2
        } else {
            1
        }
    }
}

fn catalog_role(kind: RoleKind) -> Option<RoleDefinition> {
    TOWN_ROLES
        .iter()
        .chain(MAFIA_ROLES)
        .chain(NEUTRAL_ROLES)
        .copied()
        .find(|role| role.kind == kind)
}

fn eligible_roles(
    config: &RoleSelectionConfig,
) -> Result<Vec<(RoleDefinition, RoleSelectionRule)>, String> {
    let rules = if config.roles.is_empty() {
        TOWN_ROLES
            .iter()
            .chain(MAFIA_ROLES)
            .chain(NEUTRAL_ROLES)
            .map(|role| RoleSelectionRule {
                role: role.kind,
                weight: 1.0,
                minimum: 0,
                maximum: None,
                tier: None,
            })
            .collect()
    } else {
        config.roles.clone()
    };
    let mut seen = Vec::new();
    let mut result = Vec::new();
    for rule in rules {
        if seen.contains(&rule.role) {
            return Err(format!("duplicate role rule: {}", rule.role));
        }
        if !rule.weight.is_finite() || rule.weight < 0.0 {
            return Err(format!("invalid weight for {}", rule.role));
        }
        if rule.maximum.is_some_and(|maximum| maximum < rule.minimum) {
            return Err(format!("maximum is below minimum for {}", rule.role));
        }
        let Some(role) = catalog_role(rule.role) else {
            return Err(format!("unknown role: {:?}", rule.role));
        };
        seen.push(rule.role);
        result.push((role, rule));
    }
    Ok(result)
}

pub fn validate_role_selection_config(
    count: usize,
    config: &RoleSelectionConfig,
) -> Result<(), String> {
    let roles = eligible_roles(config)?;
    if config.algorithm == RoleSelectionAlgorithm::ExplicitSlots {
        if config.explicit_slots.len() != count {
            return Err(format!(
                "explicit slot count must equal player count ({count})"
            ));
        }
        let mut counts = HashMap::new();
        for kind in &config.explicit_slots {
            let role = catalog_role(*kind).ok_or_else(|| format!("unknown role: {:?}", kind))?;
            let current = counts.entry(*kind).or_insert(0usize);
            *current += 1;
            if role.unique && *current > 1 {
                return Err(format!("unique role repeated: {}", role.name));
            }
        }
        return Ok(());
    }
    let minimums: usize = roles.iter().map(|(_, rule)| rule.minimum).sum();
    if minimums > count {
        return Err("role minimums exceed player count".into());
    }
    for target in &config.tier_targets {
        if target
            .maximum
            .is_some_and(|maximum| maximum < target.minimum)
        {
            return Err(format!("tier {} maximum is below minimum", target.tier));
        }
    }
    for limit in &config.faction_limits {
        if limit.maximum.is_some_and(|maximum| maximum < limit.minimum) {
            return Err(format!("{:?} maximum is below minimum", limit.faction));
        }
    }
    Ok(())
}

pub fn select_roles(
    count: usize,
    config: &RoleSelectionConfig,
    mut random: impl FnMut() -> f64,
) -> Result<Vec<RoleDefinition>, String> {
    validate_role_selection_config(count, config)?;
    if config.algorithm == RoleSelectionAlgorithm::ExplicitSlots {
        return Ok(config
            .explicit_slots
            .iter()
            .map(|kind| catalog_role(*kind).expect("validated role"))
            .collect());
    }
    let candidates = eligible_roles(config)?;
    let mut selected = Vec::with_capacity(count);
    let mut counts: HashMap<RoleKind, usize> = HashMap::new();
    let mut faction_counts: HashMap<Faction, usize> = HashMap::new();
    let mut tier_counts: HashMap<u8, usize> = HashMap::new();
    for _ in 0..count {
        let mut eligible = Vec::new();
        for (index, (role, rule)) in candidates.iter().enumerate() {
            let current = *counts.get(&role.kind).unwrap_or(&0);
            let maximum =
                rule.maximum
                    .unwrap_or(usize::MAX)
                    .min(if role.unique { 1 } else { usize::MAX });
            if current >= maximum {
                continue;
            }
            if current < rule.minimum || rule.weight > 0.0 {
                if let Some(limit) = config
                    .faction_limits
                    .iter()
                    .find(|limit| limit.faction == role.faction)
                {
                    if limit.maximum.is_some_and(|maximum| {
                        *faction_counts.get(&role.faction).unwrap_or(&0) >= maximum
                    }) {
                        continue;
                    }
                }
                eligible.push(index);
            }
        }
        if eligible.is_empty() {
            return Err("role constraints cannot produce enough roles".into());
        }
        let unmet_roles: Vec<usize> = eligible
            .iter()
            .copied()
            .filter(|index| {
                let (role, rule) = &candidates[*index];
                *counts.get(&role.kind).unwrap_or(&0) < rule.minimum
            })
            .collect();
        if !unmet_roles.is_empty() {
            eligible = unmet_roles;
        } else {
            let unmet_factions: Vec<usize> = eligible
                .iter()
                .copied()
                .filter(|index| {
                    let role = candidates[*index].0;
                    config.faction_limits.iter().any(|limit| {
                        limit.faction == role.faction
                            && *faction_counts.get(&role.faction).unwrap_or(&0) < limit.minimum
                    })
                })
                .collect();
            if !unmet_factions.is_empty() {
                eligible = unmet_factions;
            }
        }
        if config.algorithm == RoleSelectionAlgorithm::TierBalanced {
            let unmet: Vec<usize> = eligible
                .iter()
                .copied()
                .filter(|index| {
                    let (_, rule) = &candidates[*index];
                    config.tier_targets.iter().any(|target| {
                        Some(target.tier) == rule.tier
                            && *tier_counts.get(&target.tier).unwrap_or(&0) < target.minimum
                    })
                })
                .collect();
            if !unmet.is_empty() {
                eligible = unmet;
            } else {
                let minimum_tier_count = eligible
                    .iter()
                    .map(|index| {
                        let (role, rule) = &candidates[*index];
                        *tier_counts
                            .get(&rule.tier.unwrap_or(role.default_tier()))
                            .unwrap_or(&0)
                    })
                    .min()
                    .unwrap_or(0);
                eligible.retain(|index| {
                    let (role, rule) = &candidates[*index];
                    *tier_counts
                        .get(&rule.tier.unwrap_or(role.default_tier()))
                        .unwrap_or(&0)
                        == minimum_tier_count
                });
            }
        }
        let total_weight: f64 = eligible
            .iter()
            .map(|index| candidates[*index].1.weight.max(0.0))
            .sum();
        let mut cursor = random().clamp(0.0, 0.999_999)
            * if total_weight > 0.0 {
                total_weight
            } else {
                eligible.len() as f64
            };
        let mut chosen = eligible[eligible.len() - 1];
        for index in eligible {
            let weight = if total_weight > 0.0 {
                candidates[index].1.weight
            } else {
                1.0
            };
            if cursor < weight {
                chosen = index;
                break;
            }
            cursor -= weight;
        }
        let (role, rule) = (&candidates[chosen].0, &candidates[chosen].1);
        *counts.entry(role.kind).or_default() += 1;
        *faction_counts.entry(role.faction).or_default() += 1;
        *tier_counts
            .entry(rule.tier.unwrap_or(role.default_tier()))
            .or_default() += 1;
        selected.push(*role);
    }
    for limit in &config.faction_limits {
        if *faction_counts.get(&limit.faction).unwrap_or(&0) < limit.minimum {
            return Err(format!("faction {:?} minimum was not met", limit.faction));
        }
    }
    for target in &config.tier_targets {
        if *tier_counts.get(&target.tier).unwrap_or(&0) < target.minimum {
            return Err(format!("tier {} minimum was not met", target.tier));
        }
    }
    Ok(selected)
}

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
        let index =
            ((random() * source.len() as f64).floor() as usize).min(source.len().saturating_sub(1));
        let Some(&chosen) = source.get(index) else {
            continue;
        };
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
            let index = cursor % values.len();
            cursor += 1;
            values.get(index).copied().unwrap_or(0.0)
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
        let original = TOWN_ROLES.iter().take(8).copied().collect::<Vec<_>>();
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

    #[test]
    fn weighted_selection_respects_role_minimums_and_maximums() {
        let config = RoleSelectionConfig {
            roles: vec![
                RoleSelectionRule {
                    role: RoleKind::Doctor,
                    weight: 0.0,
                    minimum: 1,
                    maximum: Some(1),
                    tier: Some(1),
                },
                RoleSelectionRule {
                    role: RoleKind::Investigator,
                    weight: 1.0,
                    minimum: 0,
                    maximum: Some(2),
                    tier: Some(2),
                },
                RoleSelectionRule {
                    role: RoleKind::Mafia,
                    weight: 1.0,
                    minimum: 1,
                    maximum: Some(1),
                    tier: Some(1),
                },
            ],
            ..RoleSelectionConfig::default()
        };
        let roles = select_roles(4, &config, || 0.99).expect("valid weighted configuration");
        assert_eq!(
            roles
                .iter()
                .filter(|role| role.kind == RoleKind::Doctor)
                .count(),
            1
        );
        assert_eq!(
            roles
                .iter()
                .filter(|role| role.kind == RoleKind::Mafia)
                .count(),
            1
        );
        assert!(
            roles
                .iter()
                .filter(|role| role.kind == RoleKind::Investigator)
                .count()
                <= 2
        );
    }

    #[test]
    fn explicit_slots_require_exact_count_and_preserve_order_before_shuffle() {
        let config = RoleSelectionConfig {
            algorithm: RoleSelectionAlgorithm::ExplicitSlots,
            explicit_slots: vec![RoleKind::Doctor, RoleKind::Mafia, RoleKind::Investigator],
            ..RoleSelectionConfig::default()
        };
        let roles = select_roles(3, &config, || 0.0).expect("valid explicit slots");
        assert_eq!(
            roles.iter().map(|role| role.kind).collect::<Vec<_>>(),
            config.explicit_slots
        );
        assert!(validate_role_selection_config(2, &config).is_err());
    }

    #[test]
    fn tier_balanced_selection_meets_tier_minimums() {
        let config = RoleSelectionConfig {
            algorithm: RoleSelectionAlgorithm::TierBalanced,
            roles: vec![
                RoleSelectionRule {
                    role: RoleKind::Tapper,
                    weight: 1.0,
                    minimum: 0,
                    maximum: Some(2),
                    tier: Some(1),
                },
                RoleSelectionRule {
                    role: RoleKind::Jailor,
                    weight: 1.0,
                    minimum: 0,
                    maximum: Some(1),
                    tier: Some(3),
                },
            ],
            tier_targets: vec![TierTarget {
                tier: 3,
                minimum: 1,
                maximum: Some(1),
            }],
            ..RoleSelectionConfig::default()
        };
        let roles = select_roles(2, &config, || 0.99).expect("valid tier configuration");
        assert_eq!(
            roles
                .iter()
                .filter(|role| role.kind == RoleKind::Jailor)
                .count(),
            1
        );
    }
}
