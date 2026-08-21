use serde::{Deserialize, Serialize};

use crate::room::CombatLevel;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DamageOutcome {
    NoDamage,
    Survived,
    Died,
}

pub fn resolve_damage(
    damage: CombatLevel,
    defence: CombatLevel,
    base_defence: CombatLevel,
) -> DamageOutcome {
    let effective_defence = std::cmp::max(defence as u16, base_defence as u16);
    if damage as u16 > effective_defence {
        DamageOutcome::Died
    } else if damage != CombatLevel::None {
        DamageOutcome::Survived
    } else {
        DamageOutcome::NoDamage
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VoteOutcome {
    NoElimination,
    Tie { votes: usize },
    Eliminated { player: usize, votes: usize },
}

pub fn resolve_vote(votes: &[(usize, bool)], required: usize) -> VoteOutcome {
    let highest = votes
        .iter()
        .filter(|(_, alive)| *alive)
        .map(|(count, _)| *count)
        .filter(|count| *count >= required)
        .max();
    let Some(highest) = highest else {
        return VoteOutcome::NoElimination;
    };
    let leaders = votes
        .iter()
        .enumerate()
        .filter(|(_, (count, alive))| *alive && *count == highest)
        .map(|(index, _)| index)
        .collect::<Vec<_>>();
    if leaders.len() == 1 {
        VoteOutcome::Eliminated {
            player: leaders[0],
            votes: highest,
        }
    } else {
        VoteOutcome::Tie { votes: highest }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Faction {
    Town,
    Mafia,
    Neutral,
    Unaligned,
    Maniac,
    Sniper,
}

pub fn determine_winner(players: &[(bool, Faction)]) -> Option<Faction> {
    let mut surviving = Faction::Neutral;
    for (alive, faction) in players {
        if !alive || *faction == Faction::Neutral {
            continue;
        }
        if surviving == Faction::Neutral {
            surviving = *faction;
        } else if surviving != *faction {
            return None;
        }
    }
    Some(surviving)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VisitStage {
    PreVisit,
    Visit,
    PostVisit,
}

pub fn visit_plan(players: &[(bool, bool)]) -> Vec<(VisitStage, usize)> {
    let mut result = Vec::new();
    result.extend(
        players
            .iter()
            .enumerate()
            .filter(|(_, (_, blocker))| *blocker)
            .map(|(index, _)| (VisitStage::PreVisit, index)),
    );
    result.extend(
        players
            .iter()
            .enumerate()
            .filter(|(_, (_, blocker))| !*blocker)
            .map(|(index, _)| (VisitStage::Visit, index)),
    );
    result.extend(
        players
            .iter()
            .enumerate()
            .filter(|(_, (alive, _))| *alive)
            .map(|(index, _)| (VisitStage::PostVisit, index)),
    );
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn damage_matches_typescript_comparison_rules() {
        assert_eq!(
            resolve_damage(CombatLevel::None, CombatLevel::None, CombatLevel::None),
            DamageOutcome::NoDamage
        );
        assert_eq!(
            resolve_damage(CombatLevel::Low, CombatLevel::Low, CombatLevel::None),
            DamageOutcome::Survived
        );
        assert_eq!(
            resolve_damage(CombatLevel::High, CombatLevel::Low, CombatLevel::Medium),
            DamageOutcome::Died
        );
        assert_eq!(
            resolve_damage(
                CombatLevel::Fatal,
                CombatLevel::Critical,
                CombatLevel::Critical
            ),
            DamageOutcome::Died
        );
    }

    #[test]
    fn vote_requires_unique_leader_at_quorum() {
        assert_eq!(
            resolve_vote(&[(1, true), (0, true)], 2),
            VoteOutcome::NoElimination
        );
        assert_eq!(
            resolve_vote(&[(2, true), (2, true)], 2),
            VoteOutcome::Tie { votes: 2 }
        );
        assert_eq!(
            resolve_vote(&[(1, true), (3, true), (4, false)], 2),
            VoteOutcome::Eliminated {
                player: 1,
                votes: 3
            }
        );
    }

    #[test]
    fn victory_ignores_dead_and_neutral_players() {
        assert_eq!(
            determine_winner(&[
                (true, Faction::Town),
                (false, Faction::Mafia),
                (true, Faction::Neutral)
            ]),
            Some(Faction::Town)
        );
        assert_eq!(
            determine_winner(&[(true, Faction::Town), (true, Faction::Mafia)]),
            None
        );
    }

    #[test]
    fn visit_plan_orders_blockers_first_and_living_cleanup_last() {
        assert_eq!(
            visit_plan(&[(true, false), (true, true), (false, false)]),
            vec![
                (VisitStage::PreVisit, 1),
                (VisitStage::Visit, 0),
                (VisitStage::Visit, 2),
                (VisitStage::PostVisit, 0),
                (VisitStage::PostVisit, 1),
            ]
        );
    }

    #[test]
    fn every_combat_pair_obeys_strict_damage_over_defence_ordering() {
        let levels = [
            CombatLevel::None,
            CombatLevel::Low,
            CombatLevel::Medium,
            CombatLevel::High,
            CombatLevel::Critical,
            CombatLevel::Fatal,
        ];
        for damage in levels {
            for defence in levels {
                let outcome = resolve_damage(damage, defence, CombatLevel::None);
                let expected = if damage == CombatLevel::None {
                    DamageOutcome::NoDamage
                } else if damage > defence {
                    DamageOutcome::Died
                } else {
                    DamageOutcome::Survived
                };
                assert_eq!(outcome, expected, "damage={damage:?}, defence={defence:?}");
            }
        }
    }

    #[test]
    fn base_defence_is_used_when_it_exceeds_temporary_defence() {
        assert_eq!(
            resolve_damage(CombatLevel::High, CombatLevel::None, CombatLevel::Critical),
            DamageOutcome::Survived
        );
        assert_eq!(
            resolve_damage(CombatLevel::Fatal, CombatLevel::High, CombatLevel::Critical),
            DamageOutcome::Died
        );
    }

    #[test]
    fn dead_vote_targets_never_win_and_required_zero_still_selects_a_unique_leader() {
        assert_eq!(
            resolve_vote(&[(10, false), (1, true), (0, true)], 1),
            VoteOutcome::Eliminated {
                player: 1,
                votes: 1
            }
        );
        assert_eq!(
            resolve_vote(&[(0, true), (0, true)], 0),
            VoteOutcome::Tie { votes: 0 }
        );
    }

    #[test]
    fn each_non_neutral_faction_can_be_the_sole_survivor() {
        for faction in [
            Faction::Town,
            Faction::Mafia,
            Faction::Unaligned,
            Faction::Maniac,
            Faction::Sniper,
        ] {
            assert_eq!(
                determine_winner(&[(true, faction), (true, Faction::Neutral)]),
                Some(faction)
            );
        }
        assert_eq!(
            determine_winner(&[(false, Faction::Town), (true, Faction::Neutral)]),
            Some(Faction::Neutral)
        );
    }
}
