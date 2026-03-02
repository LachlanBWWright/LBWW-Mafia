import { describe, it, expect, beforeEach } from "vitest";
import { setGameEmitter, getGameEmitter } from "../../server/servers/emitter";
import type { GameEmitter } from "./serverTypes";

// ───────────── GameEmitter singleton tests ─────────────

describe("GameEmitter singleton", () => {
  it("setGameEmitter and getGameEmitter round-trip", () => {
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
    expect(retrieved).toBe(mockEmitter);

    retrieved.to("room-1").emit("receiveMessage", "Hello");
    expect(emittedCalls.length).toBe(1);
    expect(emittedCalls[0]?.target).toBe("room-1");
    expect(emittedCalls[0]?.event).toBe("receiveMessage");
    expect(emittedCalls[0]?.args).toEqual(["Hello"]);

    retrieved.to("socket-id-123").emit("blockMessages");
    expect(emittedCalls.length).toBe(2);
    expect(emittedCalls[1]?.target).toBe("socket-id-123");
    expect(emittedCalls[1]?.event).toBe("blockMessages");

    retrieved.in("game-room").disconnectSockets();
    expect(disconnectCalls.length).toBe(1);
    expect(disconnectCalls[0]).toBe("game-room");
  });

  it("getGameEmitter returns current emitter via io proxy", async () => {
    const { io } = await import("../../server/servers/emitter");
    const emittedCalls: { target: string; event: string }[] = [];

    const mockEmitter: GameEmitter = {
      to(target: string) {
        return {
          emit(event: string) {
            emittedCalls.push({ target, event });
          },
        };
      },
      in(_target: string) {
        return { disconnectSockets() {} };
      },
    };

    setGameEmitter(mockEmitter);
    io.to("test-room").emit("update-day-time", { time: "Day" as const, dayNumber: 1, timeLeft: 10 });
    expect(emittedCalls.length).toBe(1);
    expect(emittedCalls[0]?.event).toBe("update-day-time");
  });
});

// ───────────── PartykitEmitter tests ─────────────

describe("PartykitEmitter", () => {
  it("broadcasts to room and sends to individual connections", async () => {
    const { PartykitEmitter } = await import("../../server/servers/partykit/partykitEmitter");

    const broadcastedMessages: string[] = [];
    const sentMessages: Map<string, string[]> = new Map();
    const closedConnections: string[] = [];

    const mockPartyRoom = {
      broadcast(msg: string) { broadcastedMessages.push(msg); },
      getConnection(id: string) {
        if (id === "conn-1") {
          return {
            id: "conn-1",
            send(msg: string) {
              const msgs = sentMessages.get("conn-1") ?? [];
              msgs.push(msg);
              sentMessages.set("conn-1", msgs);
            },
            close() { closedConnections.push("conn-1"); },
          };
        }
        return undefined;
      },
      getConnections() {
        return [
          { id: "conn-1", close() { closedConnections.push("conn-1"); } },
          { id: "conn-2", close() { closedConnections.push("conn-2"); } },
        ];
      },
    };

    const emitter = new PartykitEmitter(mockPartyRoom, "test-room-name");

    emitter.to("test-room-name").emit("receiveMessage", "Hello room");
    expect(broadcastedMessages.length).toBe(1);
    const parsed = JSON.parse(broadcastedMessages[0] ?? "{}") as { type: string; event: string; args: unknown[] };
    expect(parsed.type).toBe("event");
    expect(parsed.event).toBe("receiveMessage");
    expect(parsed.args).toEqual(["Hello room"]);

    emitter.to("conn-1").emit("blockMessages");
    expect(sentMessages.get("conn-1")?.length).toBe(1);
    const parsedDirect = JSON.parse(sentMessages.get("conn-1")?.[0] ?? "{}") as { event: string };
    expect(parsedDirect.event).toBe("blockMessages");

    emitter.to("conn-nonexistent").emit("receiveMessage", "test");

    emitter.in("test-room-name").disconnectSockets();
    expect(closedConnections.length).toBe(2);
    expect(closedConnections.includes("conn-1")).toBe(true);
    expect(closedConnections.includes("conn-2")).toBe(true);

    const prevCount = closedConnections.length;
    emitter.in("other-room").disconnectSockets();
    expect(closedConnections.length).toBe(prevCount);
  });
});

// ───────────── PartykitPlayerSocket tests ─────────────

describe("PartykitPlayerSocket", () => {
  it("wraps connection with correct interface", async () => {
    const { PartykitPlayerSocket } = await import(
      "../../server/servers/partykit/partykitPlayerSocket"
    );

    const sentMessages: string[] = [];
    const mockConnection = {
      id: "pk-conn-1",
      send(msg: string) { sentMessages.push(msg); },
    };

    const playerSocket = new PartykitPlayerSocket(mockConnection);
    expect(playerSocket.id).toBe("pk-conn-1");
    expect(playerSocket.data).toEqual({});

    playerSocket.join("some-room");
    playerSocket.data.position = 5;
    expect(playerSocket.data.position).toBe(5);

    playerSocket.sendCallback("cb_1", "playerName");
    expect(sentMessages.length).toBe(1);
    const parsed = JSON.parse(sentMessages[0] ?? "{}") as { type: string; callbackId: string; args: unknown[] };
    expect(parsed.type).toBe("callback");
    expect(parsed.callbackId).toBe("cb_1");
    expect(parsed.args).toEqual(["playerName"]);
  });

  it("both PlayerSocket and PartykitPlayerSocket satisfy GamePlayerSocket", async () => {
    const { PartykitPlayerSocket } = await import(
      "../../server/servers/partykit/partykitPlayerSocket"
    );
    const mockConnection = { id: "test-conn", send() {} };
    const pkSocket = new PartykitPlayerSocket(mockConnection);
    expect(typeof pkSocket.id).toBe("string");
    expect(typeof pkSocket.data).toBe("object");
    expect(typeof pkSocket.join).toBe("function");
  });
});
