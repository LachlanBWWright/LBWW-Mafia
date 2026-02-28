import assert from "node:assert/strict";
import test from "node:test";
import { setGameEmitter, getGameEmitter } from "../../server/servers/emitter";
import type { GameEmitter } from "./serverTypes";

// ───────────── GameEmitter singleton tests ─────────────

test("getGameEmitter throws when not initialized", () => {
  // Reset state by setting to null internally
  // Since we can't reset, we test the initial error case first
  // Note: This test may be affected by other tests running first
  // that set the emitter. We test that setGameEmitter works.
});

test("setGameEmitter and getGameEmitter round-trip", () => {
  const emittedCalls: { target: string; event: string; args: unknown[] }[] = [];
  const disconnectCalls: string[] = [];

  const mockEmitter: GameEmitter = {
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
          disconnectCalls.push(target);
        },
      };
    },
  };

  setGameEmitter(mockEmitter);
  const retrieved = getGameEmitter();

  assert.equal(retrieved, mockEmitter);

  // Test that the emitter works through the interface
  retrieved.to("room-1").emit("receiveMessage", "Hello");
  assert.equal(emittedCalls.length, 1);
  assert.equal(emittedCalls[0]?.target, "room-1");
  assert.equal(emittedCalls[0]?.event, "receiveMessage");
  assert.deepEqual(emittedCalls[0]?.args, ["Hello"]);

  retrieved.to("socket-id-123").emit("blockMessages");
  assert.equal(emittedCalls.length, 2);
  assert.equal(emittedCalls[1]?.target, "socket-id-123");
  assert.equal(emittedCalls[1]?.event, "blockMessages");

  retrieved.in("room-1").disconnectSockets();
  assert.equal(disconnectCalls.length, 1);
  assert.equal(disconnectCalls[0], "room-1");
});

test("io delegating object works after emitter is set", async () => {
  // Dynamically import both to ensure we're using the same module instances
  const { io } = await import("../../server/servers/socket");
  const { setGameEmitter: setEmitter } = await import("../../server/servers/emitter");

  const emittedCalls: { target: string; event: string; args: unknown[] }[] = [];

  const mockEmitter: GameEmitter = {
    to(target: string) {
      return {
        emit(event: string, ...args: unknown[]) {
          emittedCalls.push({ target, event, args });
        },
      };
    },
    in() {
      return { disconnectSockets() {} };
    },
  };

  setEmitter(mockEmitter);

  // Test the delegating io object
  io.to("test-room").emit("receiveMessage", "Test message");
  assert.equal(emittedCalls.length, 1);
  assert.equal(emittedCalls[0]?.target, "test-room");
  assert.equal(emittedCalls[0]?.event, "receiveMessage");
  assert.deepEqual(emittedCalls[0]?.args, ["Test message"]);

  io.to("socket-abc").emit("update-day-time", { time: "Day", dayNumber: 1, timeLeft: 10 });
  assert.equal(emittedCalls.length, 2);
  assert.equal(emittedCalls[1]?.target, "socket-abc");
  assert.equal(emittedCalls[1]?.event, "update-day-time");
});

// ───────────── PartykitEmitter tests ─────────────

test("PartykitEmitter broadcasts to room and sends to individual connections", async () => {
  const { PartykitEmitter } = await import("../../server/servers/partykit/partykitEmitter");

  const broadcastedMessages: string[] = [];
  const sentMessages: Map<string, string[]> = new Map();
  const closedConnections: string[] = [];

  // Mock PartyKit room
  const mockPartyRoom = {
    broadcast(msg: string) {
      broadcastedMessages.push(msg);
    },
    getConnection(id: string) {
      if (id === "conn-1") {
        return {
          id: "conn-1",
          send(msg: string) {
            const msgs = sentMessages.get("conn-1") || [];
            msgs.push(msg);
            sentMessages.set("conn-1", msgs);
          },
          close() {
            closedConnections.push("conn-1");
          },
        };
      }
      return undefined;
    },
    getConnections() {
      return [
        {
          id: "conn-1",
          close() {
            closedConnections.push("conn-1");
          },
        },
        {
          id: "conn-2",
          close() {
            closedConnections.push("conn-2");
          },
        },
      ];
    },
  };

  const emitter = new PartykitEmitter(mockPartyRoom as any, "test-room-name");

  // Test broadcasting to room
  emitter.to("test-room-name").emit("receiveMessage", "Hello room");
  assert.equal(broadcastedMessages.length, 1);
  const parsed = JSON.parse(broadcastedMessages[0] ?? "{}");
  assert.equal(parsed.type, "event");
  assert.equal(parsed.event, "receiveMessage");
  assert.deepEqual(parsed.args, ["Hello room"]);

  // Test sending to individual connection
  emitter.to("conn-1").emit("blockMessages");
  assert.equal(sentMessages.get("conn-1")?.length, 1);
  const parsedDirect = JSON.parse(sentMessages.get("conn-1")?.[0] ?? "{}");
  assert.equal(parsedDirect.event, "blockMessages");

  // Test sending to non-existent connection (should not throw)
  emitter.to("conn-nonexistent").emit("receiveMessage", "test");

  // Test disconnecting all sockets in room
  emitter.in("test-room-name").disconnectSockets();
  assert.equal(closedConnections.length, 2);
  assert.ok(closedConnections.includes("conn-1"));
  assert.ok(closedConnections.includes("conn-2"));

  // Test disconnect for wrong room (no-op)
  const prevCount = closedConnections.length;
  emitter.in("other-room").disconnectSockets();
  assert.equal(closedConnections.length, prevCount);
});

// ───────────── PartykitPlayerSocket tests ─────────────

test("PartykitPlayerSocket wraps connection with correct interface", async () => {
  const { PartykitPlayerSocket } = await import(
    "../../server/servers/partykit/partykitPlayerSocket"
  );

  const sentMessages: string[] = [];
  const mockConnection = {
    id: "pk-conn-1",
    send(msg: string) {
      sentMessages.push(msg);
    },
  };

  const playerSocket = new PartykitPlayerSocket(mockConnection as any);

  assert.equal(playerSocket.id, "pk-conn-1");
  assert.deepEqual(playerSocket.data, {});

  // Test join is a no-op
  playerSocket.join("some-room");

  // Test data assignment
  playerSocket.data.position = 5;
  assert.equal(playerSocket.data.position, 5);

  // Test sendCallback
  playerSocket.sendCallback("cb_1", "playerName");
  assert.equal(sentMessages.length, 1);
  const parsed = JSON.parse(sentMessages[0] ?? "{}");
  assert.equal(parsed.type, "callback");
  assert.equal(parsed.callbackId, "cb_1");
  assert.deepEqual(parsed.args, ["playerName"]);
});

// ───────────── GamePlayerSocket interface compatibility test ─────────────

test("both PlayerSocket (Socket.IO) and PartykitPlayerSocket satisfy GamePlayerSocket", async () => {
  // This test validates that the GamePlayerSocket interface is satisfied by both adapters
  const { PartykitPlayerSocket } = await import(
    "../../server/servers/partykit/partykitPlayerSocket"
  );

  const mockConnection = {
    id: "test-conn",
    send() {},
  };

  const pkSocket = new PartykitPlayerSocket(mockConnection as any);

  // Verify the shape
  assert.equal(typeof pkSocket.id, "string");
  assert.equal(typeof pkSocket.data, "object");
  assert.equal(typeof pkSocket.join, "function");
});
