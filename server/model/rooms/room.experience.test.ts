import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DayTime,
  GameOutcome,
  ServerEvent,
  type GameSnapshot,
} from "@mernmafia/shared/communication/events";
import {
  captureEmitter,
  createTestSocket,
} from "../testUtils/gameTestUtils.js";
import { Room } from "./room.js";
import { GamePhase } from "./gamePhase.js";
import type { LobbyConfig } from "@mernmafia/shared/game/lobbyConfig";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { gameNames, MAX_PLAYERS } from "@mernmafia/shared/game/gameNames";
import { gameAvatarIndex } from "@mernmafia/shared/game/playerAvatar";

afterEach(() => vi.useRealTimers());
function game(
  hidden = false,
  explicitSlots: LobbyConfig["roleSelection"]["explicitSlots"] = [
    "doctor",
    "investigator",
    "mafia",
  ],
) {
  vi.useFakeTimers();
  const calls = captureEmitter();
  const config: LobbyConfig = {
    size: 3,
    voteVisibility: hidden ? "hidden" : "public",
    roleSelection: {
      algorithm: "explicit-slots",
      roles: [],
      explicitSlots,
    },
  };
  const room = new Room(3, "experience", undefined, config);
  const sockets = ["a", "b", "c"].map(createTestSocket);
  sockets.forEach((socket, index) =>
    room.addUser(socket, {
      userId: String(index),
      handle: ["Mira", "Theo", "Nadia"][index],
      botSeat: index === 2,
    }),
  );
  sockets.sort((a, b) => room.userList.findIndex((user) => user.socketId === a.id) - room.userList.findIndex((user) => user.socketId === b.id));
  const latest = (id: string) =>
    calls
      .filter(
        (call) => call.event === ServerEvent.GameSnapshot && call.target === id,
      )
      .at(-1)?.args[0] as GameSnapshot;
  return { room, sockets, calls, latest };
}
describe("match feedback and privacy", () => {
  it("assigns all 20 distinct names and portraits even when every waiting handle uses the name pool", () => {
    vi.useFakeTimers();
    captureEmitter();
    const room = new Room(MAX_PLAYERS, "full-roster");
    const sockets = gameNames.map((name) => createTestSocket(`socket-${name}`));
    sockets.forEach((socket, index) => room.addUser(socket, { userId: String(index), handle: gameNames[index] }));
    expect(room.started).toBe(true);
    expect(new Set(room.userList.map((user) => user.username)).size).toBe(MAX_PLAYERS);
    expect(new Set(room.userList.map((user) => gameAvatarIndex(user.username))).size).toBe(MAX_PLAYERS);
    expect(room.userList.every((user) => user.username !== gameNames[Number(user.userId)])).toBe(true);
    expect(() => new Room(MAX_PLAYERS + 1)).toThrow(RangeError);
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("assigns unique new identities at start and rematch while preserving reconnects", () => {
    vi.useFakeTimers();
    const calls = captureEmitter();
    const room = new Room(3, "anonymous");
    const sockets = ["a", "b", "c"].map(createTestSocket);
    room.addUser(sockets[0], { userId: "1", handle: "Mira", avatarPreset: "fox" });
    room.addUser(sockets[1], { userId: "2", handle: "Theo", avatarPreset: "owl" });
    room.handleSentMessage(sockets[0], "waiting room secret", DayTime.Day);
    const result = room.addUser(sockets[2], { userId: "3", handle: "Nadia" });
    const gameNames = room.userList.map((user) => user.username);
    const namesByAccount = new Map(room.userList.map((user) => [user.userId, user.username]));
    expect(new Set(gameNames).size).toBe(3);
    expect(gameNames.every((name) => !["Mira", "Theo", "Nadia"].includes(name))).toBe(true);
    expect(result).toEqual({ status: "joined", username: room.userList.find((user) => user.socketId === sockets[2].id)!.username });
    expect(room.conversationHistory.some((entry) => entry.content.includes("waiting room secret"))).toBe(false);
    const snapshots = calls.filter((call) => call.event === ServerEvent.GameSnapshot && (call.args[0] as GameSnapshot).started).map((call) => call.args[0] as GameSnapshot);
    expect(snapshots.every((snapshot) => snapshot.players.every((player) => !player.avatarPreset && !["Mira", "Theo", "Nadia"].includes(player.name)))).toBe(true);
    const resumed = createTestSocket("resumed");
    const name = room.userList.find((user) => user.socketId === sockets[0].id)!.username;
    room.setConnected(sockets[0].id, false);
    expect(room.resumeUser(sockets[0].id, resumed)).toEqual({ status: "joined", username: name });
    room.endGame({ outcome: GameOutcome.Draw });
    [resumed, sockets[1], sockets[2]].forEach((socket) => room.readyForRematch(socket));
    expect(room.userList.every((user) => namesByAccount.get(user.userId) !== user.username)).toBe(true);
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("sends account avatars only while waiting, including in roster events", () => {
    vi.useFakeTimers();
    const calls = captureEmitter();
    const room = new Room(2, "avatars");
    const first = createTestSocket("avatar-a");
    const second = createTestSocket("avatar-b");
    room.addUser(first, { userId: "a", handle: "A", avatarPreset: "fox" });
    room.sendSnapshot(first.id);
    const waiting = calls.filter((call) => call.event === ServerEvent.GameSnapshot && call.target === first.id).at(-1)?.args[0] as GameSnapshot;
    expect(waiting.players[0].avatarPreset).toBe("fox");
    calls.length = 0;
    room.addUser(second, { userId: "b", handle: "B", avatarPreset: "owl" });
    const started = calls.filter((call) => call.event === ServerEvent.GameSnapshot && call.target === first.id).at(-1)?.args[0] as GameSnapshot;
    expect(started.started).toBe(true);
    expect(started.players.every((player) => player.avatarPreset === undefined)).toBe(true);
    const roster = calls.filter((call) => call.event === ServerEvent.ReceivePlayerList && call.target === room.name).at(-1)?.args[0] as GameSnapshot["players"];
    expect(roster.every((player) => player.avatarPreset === undefined)).toBe(true);
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("establishes a new match and phase before delivering initial private role clues", () => {
    const { room, sockets, calls, latest } = game(false, [
      "doctor",
      "framer",
      "mafia",
    ]);
    const previous = latest(sockets[0].id);
    room.endGame({ outcome: GameOutcome.Draw });
    room.time = GamePhase.Night;
    calls.length = 0;
    sockets.forEach((socket) => room.readyForRematch(socket));

    const clueIndex = calls.findIndex(
      (call) =>
        call.event === ServerEvent.ReceiveMessage &&
        (call.args[0] as { key?: MessageKey }).key === MessageKey.FramerTarget,
    );
    expect(clueIndex).toBeGreaterThan(-1);
    const framerSocketId = calls[clueIndex].target;
    const snapshotIndex = calls.findIndex(
      (call) =>
        call.target === framerSocketId &&
        call.event === ServerEvent.GameSnapshot &&
        (call.args[0] as GameSnapshot).matchId !== previous.matchId,
    );
    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(snapshotIndex).toBeLessThan(clueIndex);
    const first = calls[snapshotIndex].args[0] as GameSnapshot;
    expect(first.time).toBe(DayTime.Day);
    expect(first.dayNumber).toBe(1);
    expect(first.phaseVersion).toBeGreaterThan(previous.phaseVersion ?? 0);
    expect(first.players.filter((player) => player.role)).toHaveLength(1);
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("does not reveal opponents before the recap and retains the group for replay", () => {
    const { room, sockets, latest } = game();
    const first = latest(sockets[0].id);
    expect(first.players.filter((player) => player.role)).toHaveLength(1);
    const id = first.matchId;
    room.endGame({ outcome: GameOutcome.Draw });
    expect(latest(sockets[0].id).recap?.players).toHaveLength(3);
    expect(latest(sockets[0].id).players.every((player) => player.role)).toBe(
      true,
    );
    room.readyForRematch(sockets[0]);
    expect(room.gameHasEnded).toBe(true);
    room.readyForRematch(sockets[1]);
    room.readyForRematch(sockets[2]);
    expect(room.gameHasEnded).toBe(false);
    expect(latest(sockets[0].id).matchId).not.toBe(id);
    expect(latest(sockets[0].id).recap).toBeUndefined();
    expect(
      latest(sockets[0].id).players.filter((player) => player.role),
    ).toHaveLength(1);
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("distinguishes abstention from pending votes and excludes all vote metadata in hidden lobbies", () => {
    const { room, sockets, latest, calls } = game(true);
    room.handleVote(sockets[0], null, DayTime.Day);
    room.handleVote(sockets[1], 2, DayTime.Day);
    expect(latest(sockets[0].id).action?.vote).toBeNull();
    expect(latest(sockets[1].id).action?.vote).toBe(room.playerList[2].username);
    for (const player of latest(sockets[0].id).players) {
      expect(player.voteStatus).toBeUndefined();
      expect(player.voteTarget).toBeUndefined();
      expect(player.votesReceived).toBeUndefined();
    }
    expect(
      calls
        .filter(
          (call) =>
            call.target === room.name &&
            call.event === ServerEvent.ReceiveMessage,
        )
        .some((call) =>
          String((call.args[0] as { key: string }).key).startsWith("vote_cast"),
        ),
    ).toBe(false);
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("updates visit selections and cancels them before night resolves", () => {
    const { room, sockets, latest } = game();
    room.startNightSession(1, 1000);
    const index = room.playerList.findIndex(
      (player) => player.role.name === "Doctor",
    );
    const target = (index + 1) % 3;
    room.handleVisit(sockets[index], target, DayTime.Night);
    expect(latest(sockets[index].id).action?.visit).toBe(
      room.playerList[target].username,
    );
    room.handleVisit(sockets[index], (index + 2) % 3, DayTime.Night);
    expect(latest(sockets[index].id).action?.visit).toBe(
      room.playerList[(index + 2) % 3].username,
    );
    room.handleVisit(sockets[index], null, DayTime.Night);
    expect(latest(sockets[index].id).action?.visit).toBeNull();
    expect(room.playerList[index].role.visiting).toBeNull();
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("rejects dead-player actions and preserves presence for a reserved seat", () => {
    const { room, sockets, latest } = game();
    room.playerList[0].isAlive = false;
    room.handleVote(sockets[0], 1, DayTime.Day);
    expect(room.playerList[1].votesReceived).toBe(0);
    room.setConnected(sockets[0].id, false);
    expect(latest(sockets[1].id).players[0].connected).toBe(false);
    room.time = GamePhase.Night;
    room.handleVisit(sockets[0], 1, DayTime.Night);
    expect(room.playerList[0].role.visiting).toBeNull();
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("preserves blocked feedback when the player also submitted a faction vote", () => {
    const { room, sockets, latest } = game();
    room.startNightSession(1, 1000);
    const mafiaIndex = room.playerList.findIndex(
      (player) => player.role.name === "Mafia",
    );
    room.handleVote(sockets[mafiaIndex], (mafiaIndex + 1) % 3, DayTime.Night);
    room.playerList[mafiaIndex].role.roleblocked = true;

    vi.advanceTimersByTime(15000);

    expect(latest(sockets[mafiaIndex].id).action).toMatchObject({
      outcome: "blocked",
      feedback: "Your night action was blocked.",
    });
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("allows an ended seat to be replaced before the connected group replays", () => {
    const { room, sockets, latest } = game();
    const departedName = room.playerList[0].username;
    room.endGame({ outcome: GameOutcome.Draw });
    room.readyForRematch(sockets[0]);
    room.removePlayer(sockets[0].id);
    const replacement = createTestSocket("replacement");
    expect(
      room.addUser(replacement, { userId: "replacement", handle: "Leah" })
        .status,
    ).toBe("joined");
    expect(room.readyPlayers.has(departedName)).toBe(false);
    room.readyForRematch(sockets[0]);
    expect(room.readyPlayers.has(room.userList.find((user) => user.socketId === sockets[1].id)!.username)).toBe(false);
    expect(room.gameHasEnded).toBe(true);
    expect(
      latest(replacement.id).recap?.players.map((player) => player.name),
    ).toContain(departedName);

    room.readyForRematch(sockets[1]);
    room.readyForRematch(sockets[2]);
    room.readyForRematch(replacement);

    expect(room.gameHasEnded).toBe(false);
    expect(room.playerList.map((player) => player.user.socketId).sort()).toEqual(["replacement", sockets[1].id, sockets[2].id].sort());
    expect(
      latest(replacement.id).players.filter((player) => player.role),
    ).toHaveLength(1);
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("releases permanently departed seats at game end while retaining their recap", () => {
    const { room, sockets, latest } = game();
    const departedName = room.playerList[0].username;
    room.setConnected(sockets[0].id, false);
    room.removePlayer(sockets[0].id);
    expect(room.userList).toHaveLength(3);
    room.endGame({ outcome: GameOutcome.Draw });

    expect(room.userList.map((user) => user.socketId)).toEqual([sockets[1].id, sockets[2].id]);
    expect(
      latest(sockets[1].id).recap?.players.map((player) => player.name),
    ).toContain(departedName);
    expect(sockets[1].data.position).toBe(0);
    const replacement = createTestSocket("replacement");
    expect(
      room.addUser(replacement, { userId: "replacement", handle: "Leah" })
        .status,
    ).toBe("joined");
    room.readyForRematch(sockets[1]);
    room.readyForRematch(sockets[2]);
    room.readyForRematch(replacement);
    expect(room.gameHasEnded).toBe(false);
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("retains a disconnected seat that is still within its reconnect grace", () => {
    const { room, sockets } = game();
    room.setConnected(sockets[0].id, false);
    room.endGame({ outcome: GameOutcome.Draw });
    expect(room.userList).toHaveLength(3);
    const resumed = createTestSocket("resumed");
    expect(room.resumeUser(sockets[0].id, resumed).status).toBe("joined");
    room.readyForRematch(resumed);
    room.readyForRematch(sockets[1]);
    room.readyForRematch(sockets[2]);
    expect(room.gameHasEnded).toBe(false);
    room.endGame({ outcome: GameOutcome.Draw });
  });
});
