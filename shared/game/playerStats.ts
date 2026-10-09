import { allRoles } from "./rolesList";
import type { PlayerStats } from "../trpc/appRouter";
const factions = new Map(allRoles.map((role) => [role.name, role.faction]));
/** Rows must be ordered newest first. Faction refers to the player's role. */
export function summarizePlayerStats(
  rows: { role: string; won: boolean }[],
): PlayerStats {
  const roles = new Map<
    string,
    { role: string; games: number; wins: number }
  >();
  const groups = new Map<
    string,
    { faction: string; games: number; wins: number }
  >();
  let currentStreak = 0,
    bestWinStreak = 0,
    running = 0,
    firstLossSeen = false;
  for (const row of rows) {
    const role = roles.get(row.role) ?? { role: row.role, games: 0, wins: 0 };
    role.games++;
    if (row.won) role.wins++;
    roles.set(row.role, role);
    const affiliation = factions.get(row.role) ?? "unknown";
    const faction = groups.get(affiliation) ?? {
      faction: affiliation,
      games: 0,
      wins: 0,
    };
    faction.games++;
    if (row.won) faction.wins++;
    groups.set(affiliation, faction);
    if (row.won) {
      running++;
      bestWinStreak = Math.max(bestWinStreak, running);
      if (!firstLossSeen) currentStreak++;
    } else {
      running = 0;
      firstLossSeen = true;
    }
  }
  const wins = rows.filter((row) => row.won).length;
  const recent = rows.slice(0, 10);
  return {
    gamesPlayed: rows.length,
    wins,
    losses: rows.length - wins,
    winRate: rows.length ? wins / rows.length : 0,
    currentStreak,
    bestWinStreak,
    roles: [...roles.values()].sort(
      (a, b) => b.games - a.games || a.role.localeCompare(b.role),
    ),
    factions: [...groups.values()].sort((a, b) =>
      a.faction.localeCompare(b.faction),
    ),
    recentResults: recent.map((row) => row.won),
    recentWinRate: recent.length
      ? recent.filter((row) => row.won).length / recent.length
      : 0,
  };
}
