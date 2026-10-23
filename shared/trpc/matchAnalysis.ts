import { z } from "zod";
import type { MatchHistoryEvent } from "./validators";
import { allRoles } from "../game/rolesList";

export const replayInputSchema = z.object({
  matchId: z.number().int().positive(),
});
export const balanceInputSchema = z.object({
  limit: z.number().int().min(1).max(500).default(200),
});
export type ReplayParticipant = {
  username: string;
  role: string;
  won: boolean;
};
export type MatchReplay = {
  id: number;
  roomName: string;
  startedAt: Date;
  endedAt: Date;
  winningFaction: string;
  winningRoles: string[];
  participants: ReplayParticipant[];
  events: MatchHistoryEvent[];
};
export type BalanceRate = {
  games: number;
  wins: number;
  draws: number;
  winRate: number;
};
export type MatchBalanceSummary = {
  sampleSize: number;
  draws: number;
  roles: (BalanceRate & { role: string })[];
  factions: (BalanceRate & { faction: string })[];
  compositions: {
    roles: string[];
    roster: "initial" | "final";
    games: number;
    draws: number;
    wins: { faction: string; wins: number; winRate: number }[];
  }[];
};
export type MatchAnalysisServices = {
  getReplay(input: {
    matchId: number;
    viewerId: string;
    isAdmin: boolean;
  }): Promise<MatchReplay>;
  getBalance(input: { limit: number }): Promise<MatchBalanceSummary>;
};
export type AnalysisMatch = Omit<MatchReplay, "participants"> & {
  participants: (ReplayParticipant & { userId: string | null })[];
};

/** Stored legacy matches may have no phase labels; preserve their chronological events. */
export function participantReplay(
  match: AnalysisMatch,
  viewerId: string,
  isAdmin: boolean,
  now = Date.now(),
): MatchReplay | null {
  if (
    !Number.isFinite(match.endedAt.getTime()) ||
    match.endedAt.getTime() > now ||
    match.endedAt < match.startedAt
  )
    return null;
  const identities = new Set(
    match.participants
      .filter((p) => p.userId === viewerId)
      .map((p) => p.username),
  );
  if (!isAdmin && identities.size === 0) return null;
  return {
    id: match.id,
    roomName: match.roomName,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    winningFaction: match.winningFaction,
    winningRoles: match.winningRoles,
    participants: match.participants.map(({ username, role, won }) => ({
      username,
      role,
      won,
    })),
    events: match.events
      .filter(
        (e) =>
          e.type !== "whisper" ||
          identities.has(e.actor) ||
          identities.has(e.target),
      )
      .sort((a, b) => a.time - b.time),
  };
}

const factionOf = (role: string) =>
  allRoles.find((entry) => entry.name === role)?.faction ?? "unknown";
const drawResult = (faction: string) =>
  ["draw", "tie", "none", "", "no winner"].includes(faction.toLowerCase());
/** Rates include draws in the denominator. Role games count player appearances; faction games count matches. */
export function summarizeMatchBalance(
  matches: AnalysisMatch[],
  now = Date.now(),
): MatchBalanceSummary {
  const complete = matches.filter(
    (match) =>
      Number.isFinite(match.endedAt.getTime()) &&
      match.endedAt.getTime() <= now &&
      match.endedAt >= match.startedAt &&
      match.participants.length > 0,
  );
  const roles = new Map<string, BalanceRate>();
  const factions = new Map<string, BalanceRate>();
  const compositions = new Map<
    string,
    MatchBalanceSummary["compositions"][number]
  >();
  for (const match of complete) {
    const draw = drawResult(match.winningFaction);
    for (const p of match.participants) {
      const rate = roles.get(p.role) ?? {
        games: 0,
        wins: 0,
        draws: 0,
        winRate: 0,
      };
      rate.games++;
      rate.wins += !draw && p.won ? 1 : 0;
      rate.draws += draw ? 1 : 0;
      rate.winRate = rate.wins / rate.games;
      roles.set(p.role, rate);
    }
    const represented = new Set(
      match.participants.map((p) => factionOf(p.role)),
    );
    for (const faction of represented) {
      const rate = factions.get(faction) ?? {
        games: 0,
        wins: 0,
        draws: 0,
        winRate: 0,
      };
      rate.games++;
      rate.wins +=
        !draw &&
        match.participants.some((p) => factionOf(p.role) === faction && p.won)
          ? 1
          : 0;
      rate.draws += draw ? 1 : 0;
      rate.winRate = rate.wins / rate.games;
      factions.set(faction, rate);
    }
    const initial = match.events.filter(
      (e) => e.kind === "role_reveal" && e.phase === "starting",
    );
    const hasInitial =
      initial.length === match.participants.length &&
      new Set(initial.map((e) => e.actor)).size === initial.length;
    const roster = hasInitial ? "initial" : "final";
    const compositionRoles = (
      hasInitial
        ? initial.map((e) => e.content)
        : match.participants.map((p) => p.role)
    ).sort();
    const key = JSON.stringify([roster, compositionRoles]);
    const group = compositions.get(key) ?? {
      roles: compositionRoles,
      roster,
      games: 0,
      draws: 0,
      wins: [],
    };
    group.games++;
    group.draws += draw ? 1 : 0;
    if (!draw) {
      const winner = group.wins.find(
        (entry) => entry.faction === match.winningFaction,
      );
      if (winner) winner.wins++;
      else
        group.wins.push({ faction: match.winningFaction, wins: 1, winRate: 0 });
    }
    compositions.set(key, group);
  }
  return {
    sampleSize: complete.length,
    draws: complete.filter((match) => drawResult(match.winningFaction)).length,
    roles: [...roles]
      .map(([role, rate]) => ({ role, ...rate }))
      .sort((a, b) => b.games - a.games || a.role.localeCompare(b.role)),
    factions: [...factions]
      .map(([faction, rate]) => ({ faction, ...rate }))
      .sort((a, b) => a.faction.localeCompare(b.faction)),
    compositions: [...compositions.values()]
      .map((group) => ({
        ...group,
        wins: group.wins.map((entry) => ({
          ...entry,
          winRate: entry.wins / group.games,
        })),
      }))
      .sort((a, b) => b.games - a.games),
  };
}
