import {
  DayTime,
  GameOutcome,
  ServerEvent,
} from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assignRole,
  captureEmitter,
  createTestSocket,
  installNoopEmitter,
} from "../testUtils/gameTestUtils.js";
import { doctorDefinition } from "../roles/definitions/town.js";
import { Player } from "../player/player.js";
import { User } from "../user/user.js";
import { GamePhase } from "./gamePhase.js";
import { Room } from "./room.js";
import { GameSystems } from "./systems/gameSystems.js";

afterEach(() => {
  vi.useRealTimers();
});

function addUsers(room: Room, labels: string[]) {
  const sockets = labels.map((label) => createTestSocket(`${label}-socket`));
  for (const socket of sockets) {
    room.addUser(socket);
  }
  return sockets;
}

describe("Room lifecycle", () => {
  it("starts a game by creating players, roles, factions, systems, and day phase", async () => {
    const emittedCalls = captureEmitter();
    const room = new Room(4, "room-start");
    addUsers(room, ["a", "b", "c", "d"]);
    await Promise.resolve();

    expect(room.started).toBe(true);
    expect(room.playerList).toHaveLength(4);
    expect(room.playerList.every((player) => player.role)).toBe(true);
    expect(room.factionList.every((faction) => faction.memberList.length > 0)).toBe(
      true,
    );
    expect(room.systems).toBeInstanceOf(GameSystems);
    expect(room.time).toBe(GamePhase.Day);
    expect(
      emittedCalls.some(
        (call) =>
          call.target === room.name &&
          call.event === ServerEvent.ReceiveMessage &&
          (call.args[0] as { key?: MessageKey }).key === MessageKey.Day1Started,
      ),
    ).toBe(true);

    room.endGame({ outcome: GameOutcome.Draw });
  });

  it("starts automatically exactly once when the room becomes full", async () => {
    vi.useFakeTimers();
    installNoopEmitter();
    const room = new Room(2, "room-full-once");
    const startSpy = vi.spyOn(room, "startGame");

    addUsers(room, ["a", "b"]);
    await vi.runOnlyPendingTimersAsync();

    expect(startSpy).toHaveBeenCalledOnce();
    expect(room.playerList).toHaveLength(2);

    room.endGame({ outcome: GameOutcome.Draw });
  });

  it("removes a pre-game user and reindexes remaining sockets", () => {
    const emittedCalls = captureEmitter();
    const room = new Room(3, "room-remove-lobby");
    const socketA = createTestSocket("socket-a");
    const socketB = createTestSocket("socket-b");
    room.addUser(socketA);
    room.addUser(socketB);

    room.removePlayer(socketA.id);

    expect(room.userList.map((user) => user.socketId)).toEqual([socketB.id]);
    expect(socketB.data.position).toBe(0);
    expect(
      emittedCalls.some(
        (call) =>
          call.target === room.name &&
          call.event === ServerEvent.ReceiveMessage &&
          (call.args[0] as { key?: MessageKey }).key === MessageKey.PlayerLeftRoom,
      ),
    ).toBe(true);
  });

  it("marks an in-game player for fatal damage when they abandon", () => {
    installNoopEmitter();
    const room = new Room(2, "room-remove-game");
    const socket = createTestSocket("socket-a");
    const user = new User(socket, "alpha");
    const player = new Player(user);
    room.userList = [user];
    room.playerList = [player];
    room.started = true;
    assignRole(room, player, doctorDefinition);

    room.removePlayer(socket.id);

    expect(player.role.damage).toBeGreaterThan(player.role.defence);
  });

  it("wrong-phase actions do not mutate chat, vote, visit, whisper, or action history", () => {
    installNoopEmitter();
    const room = new Room(2, "room-wrong-phase");
    const socketA = createTestSocket("socket-a");
    const socketB = createTestSocket("socket-b");
    const userA = new User(socketA, "alpha");
    const userB = new User(socketB, "beta");
    socketA.data.position = 0;
    socketB.data.position = 1;
    const playerA = new Player(userA);
    const playerB = new Player(userB);
    room.userList = [userA, userB];
    room.playerList = [playerA, playerB];
    room.started = true;
    room.time = GamePhase.Day;
    assignRole(room, playerA, doctorDefinition);
    assignRole(room, playerB, doctorDefinition);

    room.handleSentMessage(socketA, "hello", DayTime.Night);
    room.handleVote(socketA, 1, DayTime.Night);
    room.handleVisit(socketA, 1, DayTime.Night);
    room.handleWhisper(socketA, 1, "secret", DayTime.Night);

    expect(room.conversationHistory).toEqual([]);
    expect(room.actionHistory).toEqual([]);
    expect(playerA.hasVoted).toBe(false);
    expect(playerB.votesReceived).toBe(0);
    expect(playerA.role.visiting).toBeNull();
  });
});
