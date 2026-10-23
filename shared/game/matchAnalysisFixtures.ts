import type { MatchReplay, MatchBalanceSummary } from "../trpc/matchAnalysis";
export const replayFixture: MatchReplay = {
  id: 1042,
  roomName: "Friday Night",
  startedAt: new Date("2026-08-12T10:00:00Z"),
  endedAt: new Date("2026-08-12T10:30:00Z"),
  winningFaction: "Town",
  winningRoles: ["Doctor", "Townie"],
  participants: [
    { username: "Morgan", role: "Doctor", won: true },
    { username: "Alex", role: "Mafioso", won: false },
    { username: "Sam", role: "Townie", won: true },
  ],
  events: [
    {
      time: Date.parse("2026-08-12T10:01:00Z"),
      type: "system",
      content: "Night 1 begins.",
    },
    {
      time: Date.parse("2026-08-12T10:02:00Z"),
      type: "action",
      actor: "Morgan",
      target: "Sam",
      content: "Protected Sam.",
    },
    {
      time: Date.parse("2026-08-12T10:03:00Z"),
      type: "system",
      content: "Day 1 begins. Nobody died.",
    },
    {
      time: Date.parse("2026-08-12T10:04:00Z"),
      type: "chat",
      actor: "Sam",
      content: "Alex's claim does not add up.",
    },
    {
      time: Date.parse("2026-08-12T10:05:00Z"),
      type: "action",
      actor: "Sam",
      target: "Alex",
      content: "Voted for Alex.",
    },
    {
      time: Date.parse("2026-08-12T10:06:00Z"),
      type: "system",
      content: "Alex was eliminated. Town won.",
    },
  ],
};
export const balanceFixture: MatchBalanceSummary = {
  sampleSize: 32,
  draws: 2,
  roles: [
    { role: "Doctor", games: 16, wins: 9, draws: 1, winRate: 9 / 16 },
    { role: "Mafioso", games: 32, wins: 13, draws: 2, winRate: 13 / 32 },
  ],
  factions: [
    { faction: "Town", games: 32, wins: 17, draws: 2, winRate: 17 / 32 },
    { faction: "Mafia", games: 32, wins: 13, draws: 2, winRate: 13 / 32 },
  ],
  compositions: [
    {
      roles: ["Doctor", "Mafioso", "Townie", "Townie"],
      roster: "initial",
      games: 12,
      draws: 1,
      wins: [
        { faction: "Town", wins: 7, winRate: 7 / 12 },
        { faction: "Mafia", wins: 4, winRate: 4 / 12 },
      ],
    },
  ],
};
