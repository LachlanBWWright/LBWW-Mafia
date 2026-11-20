import { afterEach, describe, expect, it, vi } from "vitest";
import { DayTime, GameOutcome, ServerEvent, type GameSnapshot } from "@mernmafia/shared/communication/events";
import type { GameRules } from "@mernmafia/shared/game/gameRules";
import { captureEmitter, createTestSocket } from "../testUtils/gameTestUtils.js";
import { Room } from "./room.js";
import { CombatLevel } from "../roles/combatLevel.js";

function setup(rules: GameRules = {}) {
  vi.useFakeTimers();
  const calls = captureEmitter();
  const config = { size: 4, rules, roleSelection: { algorithm: "explicit-slots" as const, roles: [], explicitSlots: ["doctor" as const, "mafia" as const, "investigator" as const, "bodyguard" as const] } };
  const room = new Room(4, "custom-rules", undefined, config);
  const observer = createTestSocket("observer");
  room.addSpectator(observer);
  const sockets = ["a", "b", "c", "d"].map(createTestSocket);
  sockets.forEach(socket => room.addUser(socket));
  sockets.sort((a, b) => room.userList.findIndex((user) => user.socketId === a.id) - room.userList.findIndex((user) => user.socketId === b.id));
  function snapshot() { room.sendSnapshot(observer.id); return calls.filter(call => call.target === observer.id && call.event === ServerEvent.GameSnapshot).at(-1)!.args[0] as GameSnapshot; }
  return { room, sockets, calls, snapshot, config, observer };
}
afterEach(() => vi.useRealTimers());

describe("custom game rule execution", () => {
  it("freezes setup and applies independent first-day/day/night timers", () => {
    const { room, snapshot, config } = setup({ timing: { firstDaySeconds: 8, daySeconds: 31, nightSeconds: 12 } });
    config.rules.timing!.daySeconds = 99;
    expect(snapshot().timeLeft).toBe(8);
    vi.advanceTimersByTime(8000);
    expect(snapshot().time).toBe(DayTime.Night);
    expect(snapshot().timeLeft).toBe(12);
    room.startDaySession(2, 1000);
    expect(snapshot().timeLeft).toBe(31);
    expect(snapshot().setup?.rules.timing.daySeconds).toBe(31);
    expect(Object.isFrozen(room.lobbyConfig?.rules?.timing)).toBe(true);
  });
  it("ends a day early only after votes and optional day abilities are submitted", () => {
    const { room, sockets, snapshot } = setup({ timing: { earlyEnd: true, daySeconds: 60 } });
    room.startDaySession(2, 1000);
    sockets.forEach(socket => room.handleVisit(socket, null, DayTime.Day));
    sockets.slice(0, 3).forEach(socket => room.handleVote(socket, null, DayTime.Day));
    expect(snapshot().time).toBe(DayTime.Day);
    room.handleVote(sockets[3]!, null, DayTime.Day);
    expect(snapshot().time).toBe(DayTime.Night);
    expect(snapshot().timeLeft).toBe(15);
  });
  it("ends night early after every available night action is submitted", () => {
    const { room, sockets, snapshot } = setup({ timing: { earlyEnd: true, nightSeconds: 40 } });
    room.startNightSession(1, 1000);
    sockets.forEach(socket => room.handleVisit(socket, null, DayTime.Night));
    expect(snapshot().time).toBe(DayTime.Night);
    const voter = room.playerList.findIndex(player => player.role.nightVote);
    room.handleVote(sockets[voter]!, (voter + 1) % 4, DayTime.Night);
    expect(snapshot().time).toBe(DayTime.Day);
    expect(snapshot().dayNumber).toBe(2);
    vi.advanceTimersByTime(40_000);
    // The cancelled night deadline cannot resolve a second time.
    expect(snapshot().dayNumber).toBe(2);
  });
  it("updates tallies when changing votes and abstaining", () => {
    const { room, sockets } = setup({ voting: { allowRevote: true } });
    room.startDaySession(2, 1000);
    room.handleVote(sockets[0]!, 1, DayTime.Day);
    room.handleVote(sockets[0]!, 2, DayTime.Day);
    expect(room.playerList.map(player => player.votesReceived)).toEqual([0, 0, 1, 0]);
    room.handleVote(sockets[0]!, null, DayTime.Day);
    expect(room.playerList[2]!.votesReceived).toBe(0);
    expect(room.playerList[0]!.voteTarget).toBeNull();
  });
  it("uses plurality and deterministic random tie breaking", () => {
    const { room, sockets } = setup({ voting: { method: "plurality", tie: "random" }, timing: { daySeconds: 10 } });
    room.setRandomSource(() => 0);
    room.startDaySession(2, 1000);
    room.handleVote(sockets[0]!, 1, DayTime.Day);
    room.handleVote(sockets[1]!, 0, DayTime.Day);
    vi.advanceTimersByTime(10_000);
    expect(room.playerList[0]!.isAlive).toBe(false);
    expect(room.playerList[1]!.isAlive).toBe(true);
  });
  it.each(["none", "faction"] as const)("does not leak dead roles with %s reveals", reveal => {
    const { room, calls, snapshot } = setup({ reveal: { onDeath: reveal, rolePool: true } });
    const dead = room.playerList[0]!;
    dead.role.damage = CombatLevel.High;
    calls.length = 0;
    room.systems!.combat.resolveRoleDamage(dead.role);
    const view = snapshot();
    expect(view.players[0]!.role).toBeUndefined();
    expect(view.players[0]!.faction).toBe(reveal === "faction" ? dead.role.group : undefined);
    expect(view.timeline!.at(-1)!.text).not.toContain(dead.role.name);
    expect(calls.some(call => call.event === ServerEvent.UpdatePlayerRole)).toBe(false);
    expect(calls).toEqual(expect.arrayContaining([expect.objectContaining({ event: ServerEvent.ReceiveMessage, args: [expect.objectContaining({ key: reveal === "faction" ? "player_died_faction" : "player_died_hidden", params: expect.objectContaining({ playerName: dead.username }) })] })]));
    expect(JSON.stringify(calls.filter(call => call.event === ServerEvent.ReceiveMessage))).not.toContain(dead.role.name);
    expect(view.setup?.rolePool).toEqual(["doctor", "mafia", "investigator", "bodyguard"]);
    room.endGame({ outcome: GameOutcome.Draw });
    expect(snapshot().players[0]!.role).toBe(dead.role.name);
  });
  it("enforces per-phase chat limits, disabled whispers, observer chat, and one public last word", () => {
    const { room, calls, sockets, observer } = setup({ communication: { whispers: false, messageLimit: 1, observerChat: false, lastWords: true } });
    room.startDaySession(2, 1000);
    calls.length = 0;
    room.conversationHistory = [];
    room.handleSentMessage(sockets[0]!, "first", DayTime.Day);
    room.handleSentMessage(sockets[0]!, "blocked", DayTime.Day);
    room.handleWhisper(sockets[0]!, 1, "secret", DayTime.Day);
    room.handleSentMessage(observer, "watching", DayTime.Day);
    expect(room.conversationHistory.filter(entry => entry.type === "chat").map(entry => entry.content)).toEqual(["first"]);
    expect(calls.some(call => call.event === ServerEvent.ReceiveWhisperMessage || call.event === ServerEvent.ReceiveSpectatorMessage)).toBe(false);
    room.playerList[0]!.isAlive = false;
    room.handleSentMessage(sockets[0]!, "farewell", DayTime.Day);
    room.handleSentMessage(sockets[0]!, "second farewell", DayTime.Day);
    expect(room.conversationHistory.map(entry => entry.content)).toContain("farewell");
    expect(room.conversationHistory.map(entry => entry.content)).not.toContain("second farewell");
    room.startNightSession(2, 1000);
    room.endDay = 10;
    room.startDaySession(3, 1000);
    room.handleSentMessage(sockets[1]!, "reset", DayTime.Day);
    expect(room.conversationHistory.map(entry => entry.content)).toContain("reset");
  });
});
