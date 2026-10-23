import { describe, expect, it } from "vitest";
import {
  participantReplay,
  summarizeMatchBalance,
  type AnalysisMatch,
} from "./matchAnalysis";
import { deserializeEventHistory } from "./validators";
const match = (overrides: Partial<AnalysisMatch> = {}): AnalysisMatch => ({
  id: 1,
  roomName: "private-room",
  startedAt: new Date(1000),
  endedAt: new Date(2000),
  winningFaction: "town",
  winningRoles: ["Doctor"],
  participants: [
    { username: "Alice", userId: "a", role: "Doctor", won: true },
    { username: "Bob", userId: "b", role: "Godfather", won: false },
    { username: "Carol", userId: "c", role: "Doctor", won: true },
  ],
  events: [
    {
      time: 1900,
      type: "whisper",
      actor: "Bob",
      target: "Carol",
      content: "secret",
    },
    {
      time: 1500,
      type: "action",
      actor: "Bob",
      target: "Alice",
      content: "attack",
      day: 1,
      phase: "night",
      kind: "night_action",
    },
    {
      time: 1800,
      type: "whisper",
      actor: "Alice",
      target: "Bob",
      content: "mine",
    },
  ],
  ...overrides,
});
describe("completed match replay", () => {
  it("authorizes actual account participants, never a matching display name", () => {
    expect(participantReplay(match(), "Alice", false, 3000)).toBeNull();
    expect(participantReplay(match(), "stranger", false, 3000)).toBeNull();
    const replay = participantReplay(match(), "a", false, 3000)!;
    expect(replay.events.map((e) => e.content)).toEqual(["attack", "mine"]);
    expect(replay.participants[0]).not.toHaveProperty("userId");
  });
  it("withholds roles and private actions until the match ends, including for admins", () => {
    expect(participantReplay(match(), "a", false, 1500)).toBeNull();
    expect(participantReplay(match(), "admin", true, 1500)).toBeNull();
    expect(
      participantReplay(match({ endedAt: new Date(0) }), "a", false, 3000),
    ).toBeNull();
  });
  it("permits completed administrator analysis without leaking other people's whispers", () => {
    expect(
      participantReplay(match(), "admin", true, 3000)?.events.map(
        (e) => e.type,
      ),
    ).toEqual(["action"]);
  });
  it("retains timeline fields through persistence validation and supports legacy histories", () => {
    expect(
      deserializeEventHistory(JSON.stringify(match().events))[1],
    ).toMatchObject({ day: 1, phase: "night", kind: "night_action" });
    expect(
      deserializeEventHistory(
        JSON.stringify([{ time: 1, type: "system", content: "Day begins" }]),
      ),
    ).toHaveLength(1);
    expect(deserializeEventHistory("[]")).toEqual([]);
  });
});
describe("anonymous balance aggregates", () => {
  it("counts role appearances and faction matches without exposing identities or chat", () => {
    const summary = summarizeMatchBalance(
      [
        match(),
        match({
          id: 2,
          winningFaction: "draw",
          participants: match().participants.map((p) => ({ ...p, won: true })),
        }),
      ],
      3000,
    );
    expect(summary.sampleSize).toBe(2);
    expect(summary.draws).toBe(1);
    expect(summary.roles.find((r) => r.role === "Doctor")).toEqual({
      role: "Doctor",
      games: 4,
      wins: 2,
      draws: 2,
      winRate: 0.5,
    });
    expect(summary.factions.find((f) => f.faction === "town")).toMatchObject({
      games: 2,
      wins: 1,
      draws: 1,
      winRate: 0.5,
    });
    const encoded = JSON.stringify(summary);
    for (const secret of ["Alice", "private-room", "secret", "userId"])
      expect(encoded).not.toContain(secret);
  });
  it("separates initial setup from legacy final rosters rather than conflating conversions", () => {
    const original = match({
      events: match().participants.map((p, index) => ({
        time: 1000,
        type: "system",
        actor: p.username,
        content: index === 0 ? "Judge" : p.role,
        phase: "starting",
        day: 0,
        kind: "role_reveal",
      })),
    });
    const summary = summarizeMatchBalance([match(), original], 3000);
    expect(summary.compositions).toHaveLength(2);
    expect(
      summary.compositions.find((g) => g.roster === "initial")?.roles,
    ).toContain("Judge");
    expect(
      summary.compositions.find((g) => g.roster === "final")?.roles,
    ).toEqual(["Doctor", "Doctor", "Godfather"]);
  });
  it("excludes unfinished, invalid, and empty records", () => {
    expect(
      summarizeMatchBalance(
        [
          match({ endedAt: new Date(5000) }),
          match({ endedAt: new Date(NaN) }),
          match({ endedAt: new Date(0) }),
          match({ participants: [] }),
        ],
        3000,
      ).sampleSize,
    ).toBe(0);
  });
});
