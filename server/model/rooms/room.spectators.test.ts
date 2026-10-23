import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DayTime,
  GameOutcome,
  JoinRoomResultCode,
  ServerEvent,
  type GameSnapshot,
} from "@mernmafia/shared/communication/events";
import {
  captureEmitter,
  createTestSocket,
} from "../testUtils/gameTestUtils.js";
import { Room } from "./room.js";
import { GamePhase } from "./gamePhase.js";

afterEach(() => vi.useRealTimers());
function setup() {
  vi.useFakeTimers();
  const calls = captureEmitter();
  const room = new Room(3, "observers", undefined, {
    size: 3,
    voteVisibility: "hidden",
    roleSelection: {
      algorithm: "explicit-slots",
      roles: [],
      explicitSlots: ["doctor", "mafia", "investigator"],
    },
  });
  const observer = createTestSocket("observer");
  room.addSpectator(observer, { userId: "observer-user", handle: "Watcher" });
  const sockets = ["a", "b", "c"].map(createTestSocket);
  sockets.forEach((socket, index) =>
    room.addUser(socket, {
      userId: `user-${index}`,
      handle: `Player ${index}`,
    }),
  );
  const snapshot = () =>
    calls
      .filter(
        (call) =>
          call.target === observer.id &&
          call.event === ServerEvent.GameSnapshot,
      )
      .at(-1)?.args[0] as GameSnapshot;
  return { room, calls, sockets, observer, snapshot };
}
describe("spectator privacy", () => {
  it("does not consume seats or reveal roles, selections, hidden votes, or private results", () => {
    const { room, observer, snapshot } = setup();
    expect(room.started).toBe(true);
    expect(room.userList).toHaveLength(3);
    const view = snapshot();
    expect(view.participation).toBe("spectator");
    expect(view.role).toBeUndefined();
    expect(view.action).toEqual({});
    expect(view.canVote).toBe(false);
    expect(
      view.players.every(
        (player) =>
          player.role === undefined && player.voteTarget === undefined,
      ),
    ).toBe(true);
    room.handleVote(observer, 0, DayTime.Day);
    room.handleVisit(observer, 0, DayTime.Day);
    room.handleWhisper(observer, 0, "leak", DayTime.Day);
    expect(
      room.actionHistory.filter((event) => event.actor === "Watcher"),
    ).toEqual([]);
    room.endGame({ outcome: GameOutcome.Draw });
    expect(snapshot().recap?.players).toHaveLength(3);
    expect(snapshot().players.every((player) => player.role)).toBe(true);
  });
  it("isolates observer and eliminated chat from living players and persisted live conversations", () => {
    const { room, sockets, observer, calls } = setup();
    room.playerList[0].isAlive = false;
    room.time = GamePhase.Day;
    calls.length = 0;
    room.handleSentMessage(observer, "observer secret", DayTime.Day);
    room.handleSentMessage(sockets[0], "dead secret", DayTime.Day);
    const messages = calls.filter(
      (call) => call.event === ServerEvent.ReceiveSpectatorMessage,
    );
    expect(messages.map((call) => call.target)).toEqual([
      observer.id,
      sockets[0].id,
      observer.id,
      sockets[0].id,
    ]);
    expect(
      calls.some((call) => call.event === ServerEvent.ReceiveChatMessage),
    ).toBe(false);
    expect(
      room.conversationHistory.some((event) =>
        event.content.includes("secret"),
      ),
    ).toBe(false);
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("never delivers faction night conversations or player whispers to observers", () => {
    const { room, observer, calls } = setup();
    const mafia = room.playerList.find(
      (player) => player.role.group === "mafia",
    )!;
    room.time = GamePhase.Night;
    calls.length = 0;
    room.handleSentMessage(mafia.user.socket, "faction secret", DayTime.Night);
    room.sendSnapshot(observer.id);
    expect(
      calls
        .filter((call) => call.target === observer.id)
        .some(
          (call) =>
            call.event === ServerEvent.ReceiveChatMessage ||
            call.event === ServerEvent.ReceiveWhisperMessage ||
            call.event === ServerEvent.ReceiveRole ||
            call.event === ServerEvent.AssignPlayerRole,
        ),
    ).toBe(false);
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("records accepted player chat and excludes rejected speech from replay", () => {
    const { room, sockets } = setup();
    room.time = GamePhase.Day;
    room.playerList[0].role.silenced = true;
    room.handleSentMessage(sockets[0], "rejected speech", DayTime.Day);
    room.handleSentMessage(sockets[1], "accepted speech", DayTime.Day);
    expect(
      room.conversationHistory.some(
        (event) => event.content === "rejected speech",
      ),
    ).toBe(false);
    expect(
      room.conversationHistory.some(
        (event) => event.content === "accepted speech",
      ),
    ).toBe(true);
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("retains observer identity on reconnect and releases observer connections without changing players", () => {
    const { room, observer, sockets } = setup();
    room.setConnected(observer.id, false);
    const resumed = createTestSocket("resumed");
    expect(room.resumeUser(observer.id, resumed)).toEqual({
      status: "joined",
      username: "Watcher",
    });
    room.removePlayer(resumed.id);
    expect(room.spectatorList).toHaveLength(0);
    expect(room.userList.map((user) => user.socketId)).toEqual(
      sockets.map((socket) => socket.id),
    );
    room.endGame({ outcome: GameOutcome.Draw });
  });
  it("bounds observers including disconnected reserved identities", () => {
    const { room } = setup();
    for (let index = 1; index < 50; index++) {
      const socket = createTestSocket(`extra${index}`);
      expect(room.addSpectator(socket).status).toBe("joined");
      room.setConnected(socket.id, false);
    }
    expect(room.addSpectator(createTestSocket("overflow"))).toEqual({
      status: "rejected",
      code: JoinRoomResultCode.RoomFull,
    });
    room.endGame({ outcome: GameOutcome.Draw });
  });
});
