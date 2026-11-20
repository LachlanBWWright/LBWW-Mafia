import { afterEach, describe, expect, it, vi } from "vitest";
import { DayTime, GameOutcome, ServerEvent, type GameSnapshot } from "@mernmafia/shared/communication/events";
import { captureEmitter, createTestSocket } from "../testUtils/gameTestUtils.js";
import { Room } from "./room.js";
import { chooseBuiltInBotAction } from "./systems/lobbyBots.js";

const rooms: Room[] = [];
function setup(fillEmptySeats = true) {
  vi.useFakeTimers();
  const calls = captureEmitter();
  const room = new Room(4, "bot-test", undefined, {
    size: 4,
    rules: { bots: { fillEmptySeats, difficulty: "challenging", personality: "argumentative" } },
    roleSelection: { algorithm: "explicit-slots", roles: [], explicitSlots: ["doctor", "mafia", "investigator", "bodyguard"] },
  });
  rooms.push(room);
  const human = createTestSocket("human");
  room.addUser(human);
  const snapshot = (id: string): GameSnapshot => {
    room.sendSnapshot(id);
    return calls.filter(call => call.target === id && call.event === ServerEvent.GameSnapshot).at(-1)!.args[0] as GameSnapshot;
  };
  return { room, human, snapshot };
}
async function flushBots() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
afterEach(() => { rooms.splice(0).forEach(room => room.dispose()); vi.useRealTimers(); });

describe("built-in lobby bot seats", () => {
  it("fills only opted-in rooms after a human joins and starts a complete match", async () => {
    const disabled = setup(false);
    expect(disabled.room.userList).toHaveLength(1);
    const { room } = setup();
    expect(room.userList).toHaveLength(4);
    expect(room.userList.filter(user => user.isBot)).toHaveLength(3);
    expect(room.playerList).toHaveLength(4);
    expect(room.started).toBe(true);
    await flushBots();
    expect(room.playerList.filter(player => player.user.isBot).every(player => player.hasVoted)).toBe(true);
    expect(room.conversationHistory.filter(entry => entry.content.includes("public claim"))).toHaveLength(3);
  });
  it("submits legal night visits using each bot's sanitized snapshot", async () => {
    const { room, snapshot } = setup();
    await flushBots();
    room.startNightSession(1, 1000);
    const decisions = room.userList.filter(user => user.isBot).map(user => ({ id: user.socketId, action: chooseBuiltInBotAction(snapshot(user.socketId), room.rules.bots) }));
    await flushBots();
    for (const { id, action } of decisions) {
      const current = snapshot(id);
      if (action.visit !== undefined) expect(current.action?.visit).toBeDefined();
      if (action.vote !== undefined) expect(current.action?.vote).toBeDefined();
    }
    expect(decisions.some(entry => entry.action.visit !== undefined)).toBe(true);
  });
  it("resets first-day bot votes before the scheduled first night", async () => {
    const { room, snapshot } = setup();
    await flushBots();
    vi.advanceTimersByTime(5000);
    await flushBots();
    for (const bot of room.playerList.filter(player => player.user.isBot))
      expect(bot.hasVoted).toBe(bot.role.nightVote);
    const mafia = room.playerList.find(player => player.user.isBot && player.role.nightVote);
    if (mafia) expect(snapshot(mafia.user.socketId).action?.vote).toBeDefined();
    expect(room.time).toBe("night");
  });
  it("readies bots once per ended match, leaving the rematch decision to humans", async () => {
    const { room, human } = setup();
    await flushBots();
    room.endGame({ outcome: GameOutcome.Draw });
    await flushBots();
    expect(room.readyPlayers.size).toBe(3);
    expect(room.gameHasEnded).toBe(true);
    room.readyForRematch(human);
    await flushBots();
    expect(room.gameHasEnded).toBe(false);
    expect(room.readyPlayers.size).toBe(0);
    expect(room.playerList).toHaveLength(4);
  });
  it("coalesces duplicate snapshots and cancels queued actions on disposal", async () => {
    const { room } = setup();
    const vote = vi.spyOn(room, "handleVote");
    room.broadcastSnapshots();
    room.broadcastSnapshots();
    room.dispose();
    await flushBots();
    expect(vote).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("varies personality and difficulty from public information alone", () => {
    const { snapshot, human, room } = setup();
    const state = snapshot(human.id);
    state.time = DayTime.Day;
    state.dayNumber = 1;
    state.canTalk = true;
    state.canVote = true;
    state.action = {};
    state.players.forEach((player, index) => { player.votesReceived = index === 1 ? 3 : 0; });
    expect(chooseBuiltInBotAction(state, { ...room.rules.bots, difficulty: "casual" }).vote).toBeNull();
    expect(chooseBuiltInBotAction(state, { ...room.rules.bots, difficulty: "challenging" }).vote).toBe(1);
    const cautious = chooseBuiltInBotAction(state, { ...room.rules.bots, personality: "cautious" });
    const deceptive = chooseBuiltInBotAction(state, { ...room.rules.bots, personality: "deceptive" });
    expect(cautious.message).not.toBe(deceptive.message);
    expect(state.players.filter(player => player.name !== state.playerName && player.role === undefined).length).toBeGreaterThan(0);
  });
  it("never submits a faction night vote against a known teammate", () => {
    const { snapshot, human, room } = setup();
    const state = snapshot(human.id);
    state.time = DayTime.Night;
    state.action = {};
    state.canVote = true;
    state.role!.nightVote = true;
    const opponents = state.players.map((player, index) => ({ player, index })).filter(({ player }) => player.name !== state.playerName);
    const teammate = opponents[0]!;
    const target = opponents[1]!;
    for (const opponent of opponents) opponent.player.role = "Custom Mafia Teammate";
    teammate.player.role = "Custom Mafia Teammate";
    teammate.player.votesReceived = 10;
    target.player.role = undefined;
    expect(chooseBuiltInBotAction(state, room.rules.bots).vote).not.toBe(teammate.index);
    expect(chooseBuiltInBotAction(state, room.rules.bots).vote).toBe(target.index);
  });
});
