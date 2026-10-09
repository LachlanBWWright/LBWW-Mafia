use super::Room;

/// Resolves a day vote without mutating room state.
pub(crate) fn resolve_day_vote(room: &Room, votes_required: usize) -> Option<usize> {
    let highest = room
        .player_list
        .iter()
        .filter(|player| player.is_alive && player.votes_received >= votes_required)
        .map(|player| player.votes_received)
        .max()?;
    let leaders = room
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
