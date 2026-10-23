import type { Player } from "../../player/player.js";

export type DayVoteOutcome =
  | { kind: "no-elimination" }
  | { kind: "tie"; candidates: Player[]; votes: number }
  | { kind: "eliminated"; player: Player; votes: number };

export function resolveDayVote(
  livingPlayers: readonly Player[],
  votesRequired: number,
): DayVoteOutcome {
  const eligiblePlayers = livingPlayers.filter(
    (player) => player.votesReceived >= votesRequired,
  );

  if (eligiblePlayers.length === 0) {
    return { kind: "no-elimination" };
  }

  const highestVoteCount = Math.max(
    ...eligiblePlayers.map((player) => player.votesReceived),
  );
  const leadingPlayers = eligiblePlayers.filter(
    (player) => player.votesReceived === highestVoteCount,
  );

  if (leadingPlayers.length !== 1) {
    return {
      kind: "tie",
      candidates: [...leadingPlayers],
      votes: highestVoteCount,
    };
  }

  return {
    kind: "eliminated",
    player: leadingPlayers[0]!,
    votes: highestVoteCount,
  };
}
