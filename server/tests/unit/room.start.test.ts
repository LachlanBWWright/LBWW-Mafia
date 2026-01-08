import { describe, it, expect, beforeEach } from "vitest";
import { Room } from "../../model/rooms/room.js";
import { SocketHandler } from "../../model/socketHandler/socketHandler.js";
import type { MessageToClient } from "../../../shared/socketTypes/socketTypes.js";

class MockSocketHandler extends SocketHandler {
  playerMessages: Record<string, MessageToClient[]> = {};
  roomMessages: { roomId: string; message: MessageToClient }[] = [];

  sendPlayerMessage(playerSocketId: string, message: MessageToClient): void {
    this.playerMessages[playerSocketId] ??= [];
    this.playerMessages[playerSocketId].push(message);
  }
  sendRoomMessage(roomId: string, message: MessageToClient): void {
    this.roomMessages.push({ roomId, message });
  }
  disconnectSockets(): void {
    // no-op for tests
  }
}

describe("Room start behaviour", () => {
  let mock: MockSocketHandler;

  beforeEach(() => {
    mock = new MockSocketHandler();
  });

  it("starts the game when the room fills and broadcasts day start and player roles", () => {
    const room = new Room(3, mock);

    room.addPlayer("p1");
    room.addPlayer("p2");
    // After two players the game should not have started
    expect(room.started).toBe(false);

    room.addPlayer("p3");

    expect(room.started).toBe(true);

    // Check that each player received an assign-player-role message
    for (const id of ["p1", "p2", "p3"]) {
      const messages = mock.playerMessages[id] ?? [];
      const hasAssign = messages.some((m) => m.name === "assign-player-role");
      expect(hasAssign).toBe(true);
    }

    // Check that the room was sent an update-day-time message (Day 1)
    const updateDay = mock.roomMessages.some(
      (r) =>
        r.message.name === "update-day-time" && r.message.data.dayNumber === 1,
    );
    expect(updateDay).toBe(true);

    // Check that each player received the update-day-time message (guards against PartyKit broadcast exclusion)
    for (const id of ["p1", "p2", "p3"]) {
      const messages = mock.playerMessages[id] ?? [];
      const hasUpdate = messages.some((m) => m.name === "update-day-time");
      expect(hasUpdate).toBe(true);
    }

    // Check that a player list was broadcast to the room when it filled
    const hasPlayerList = mock.roomMessages.some(
      (r) => r.message.name === "receive-player-list",
    );
    expect(hasPlayerList).toBe(true);
  });

  it("emitPlayerList broadcasts to room when invoked with room name", () => {
    const room = new Room(2, mock);
    room.addPlayer("alpha");
    // Explicitly call emitPlayerList with room name
    room.emitPlayerList(room.name);

    const hasPlayerList = mock.roomMessages.some(
      (r) => r.message.name === "receive-player-list",
    );
    expect(hasPlayerList).toBe(true);
  });
});
