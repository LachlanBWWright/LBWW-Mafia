import {
  ActionKind,
  DayTime,
  GameOutcome,
  JoinRoomResultCode,
  ServerEvent,
} from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { beforeEach, describe, expect, it } from "vitest";
import { setGameEmitter } from "../../servers/emitter.js";
import { Player } from "../player/player.js";
import { createRoleInstance } from "../roles/composition/roleFactory.js";
import { mafiaDefinition } from "../roles/definitions/mafia.js";
import { doctorDefinition } from "../roles/definitions/town.js";
import { GamePhase } from "./gamePhase.js";
import { Room } from "./room.js";
import { GameSystems } from "./systems/gameSystems.js";

type EmittedCall = {
  target: string;
  event: string;
  args: unknown[];
};

type TestSocket = {
  id: string;
  data: { position?: number; roomObject?: Room };
  join(room: string): void;
};

const emittedCalls: EmittedCall[] = [];

function createSocket(id: string): TestSocket {
  return {
    id,
    data: {},
    join: () => undefined,
  };
}

function createStartedRoom(name = "test-room") {
  const room = new Room(4, name);
  const sockets = [createSocket("socket-a"), createSocket("socket-b"), createSocket("socket-c")];
  room.addUser(sockets[0]);
  room.addUser(sockets[1]);
  room.addUser(sockets[2]);

  const players = room.userList.map((user) => new Player(user));
  room.playerList = players;
  room.started = true;
  room.time = GamePhase.Day;
  room.gameHasEnded = false;
  room.playerList[0]?.assignRole(createRoleInstance(doctorDefinition, room, players[0]!));
  room.playerList[1]?.assignRole(createRoleInstance(doctorDefinition, room, players[1]!));
  room.playerList[2]?.assignRole(createRoleInstance(doctorDefinition, room, players[2]!));
  room.systems = new GameSystems(room);
  return { room, sockets, players };
}

function findMessages(target: string, event: ServerEvent): unknown[] {
  return emittedCalls
    .filter((call) => call.target === target && call.event === event)
    .flatMap((call) => call.args);
}

beforeEach(() => {
  emittedCalls.length = 0;
  setGameEmitter({
    to(target: string) {
      return {
        emit(event: string, ...args: unknown[]) {
          emittedCalls.push({ target, event, args });
        },
      };
    },
    in(target: string) {
      return {
        disconnectSockets() {
          emittedCalls.push({
            target,
            event: "disconnectSockets",
            args: [],
          });
        },
      };
    },
  });
});

describe("room socket quality", () => {
  it("returns discriminated join results for success and failure", () => {
    const room = new Room(2, "join-room");
    const socketA = createSocket("socket-a");
    const socketB = createSocket("socket-b");
    const socketC = createSocket("socket-c");

    expect(room.addUser(socketA)).toEqual({
      status: "joined",
      username: room.userList[0]?.username,
    });
    expect(room.addUser(socketA)).toEqual({
      status: "rejected",
      code: JoinRoomResultCode.GenericError,
    });
    expect(room.addUser(socketB).status).toBe("joined");
    expect(room.addUser(socketC)).toEqual({
      status: "rejected",
      code: JoinRoomResultCode.RoomFull,
    });
  });

  it("rejects wrong-phase message, vote, visit, and whisper actions before room state changes", () => {
    const { room, sockets, players } = createStartedRoom("phase-room");
    const actor = players[0]!;
    const target = players[1]!;

    room.handleSentMessage(sockets[0], "hello", DayTime.Night);
    room.handleVote(sockets[0], 1, DayTime.Night);
    room.handleVisit(sockets[0], 1, DayTime.Night);
    room.handleWhisper(sockets[0], 1, "secret", DayTime.Night);

    expect(actor.hasVoted).toBe(false);
    expect(target.votesReceived).toBe(0);
    expect(actor.role.visiting).toBeNull();
    expect(room.actionHistory).toEqual([]);
    expect(findMessages(room.name, ServerEvent.ReceiveChatMessage)).toEqual([]);
    expect(findMessages(sockets[1].id, ServerEvent.ReceiveWhisperMessage)).toEqual(
      [],
    );
  });

  it("records typed action kinds and forwards tapped whispers via nullable role references", () => {
    const { room, sockets, players } = createStartedRoom("tap-room");
    const sender = players[0]!;
    const recipient = players[1]!;
    const tapper = players[2]!;

    room.setRandomSource(() => 0.9);
    sender.role.dayTappedBy = tapper.role;
    recipient.role.dayTappedBy = tapper.role;

    room.handleWhisper(sockets[0], 1, "psst", DayTime.Day);

    expect(room.actionHistory[0]?.content).toBe(ActionKind.Whisper);
    expect(
      emittedCalls.filter(
        (call) =>
          call.target === sockets[2].id &&
          call.event === ServerEvent.ReceiveWhisperMessage,
      ),
    ).toHaveLength(2);
  });

  it("emits draw outcomes without string sentinels", () => {
    const { room } = createStartedRoom("draw-room");

    room.endDay = 1;
    room.startDaySession(1, 0);

    expect(room.gameHasEnded).toBe(true);
    expect(
      findMessages(room.name, ServerEvent.ReceiveMessage).some(
        (message) =>
          typeof message === "object" &&
          message !== null &&
          "key" in message &&
          (message as { key: MessageKey }).key === MessageKey.GameEndedNobodyDied,
      ),
    ).toBe(true);
    expect(
      findMessages(room.name, ServerEvent.ReceiveMessage).some(
        (message) =>
          typeof message === "object" &&
          message !== null &&
          "key" in message &&
          (message as { key: MessageKey }).key === MessageKey.GameEndedDraw,
      ),
    ).toBe(true);
  });

  it("emits faction win outcomes through the typed end-game result", () => {
    const { room, players } = createStartedRoom("win-room");
    players[0]?.assignRole(createRoleInstance(mafiaDefinition, room, players[0]!));
    players[1]!.isAlive = false;
    players[2]!.isAlive = false;

    room.endGame({
      outcome: GameOutcome.Faction,
      factionName: players[0]!.role.group,
    });

    expect(room.gameHasEnded).toBe(true);
    expect(
      findMessages(room.name, ServerEvent.ReceiveMessage).some(
        (message) =>
          typeof message === "object" &&
          message !== null &&
          "key" in message &&
          (message as { key: MessageKey }).key === MessageKey.FactionWon,
      ),
    ).toBe(true);
  });
});
