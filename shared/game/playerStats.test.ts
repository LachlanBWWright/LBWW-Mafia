import { expect, it } from "vitest";
import { summarizePlayerStats } from "./playerStats";
it("groups results by player affiliation and counts streaks from newest first", () => {
  const stats = summarizePlayerStats([
    { role: "Doctor", won: true },
    { role: "Mafia", won: false },
    { role: "Doctor", won: true },
    { role: "Framer", won: true },
  ]);
  expect(stats.factions).toEqual([
    { faction: "mafia", games: 1, wins: 0 },
    { faction: "neutral", games: 1, wins: 1 },
    { faction: "town", games: 2, wins: 2 },
  ]);
  expect(stats.currentStreak).toBe(1);
  expect(stats.bestWinStreak).toBe(2);
  expect(stats.recentResults).toEqual([true, false, true, true]);
});
it("handles empty and bounded recent histories", () => {
  expect(summarizePlayerStats([]).winRate).toBe(0);
  const stats = summarizePlayerStats(
    Array.from({ length: 20 }, (_, i) => ({ role: "Doctor", won: i < 10 })),
  );
  expect(stats.winRate).toBe(0.5);
  expect(stats.recentWinRate).toBe(1);
  expect(stats.recentResults).toHaveLength(10);
});
