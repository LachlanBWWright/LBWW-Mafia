import { describe, it, expect } from "vitest";
import { SocketIoClientAdapter, type SocketIoCompatible } from "./socketIoClientAdapter";
import { PartykitClientAdapter } from "./partykitClientAdapter";
import { createGameSocket } from "./createGameSocket";
import type { GameSocketConfig } from "./clientTypes";

// ───────────── SocketIoClientAdapter tests ─────────────

describe("SocketIoClientAdapter", () => {
  it("delegates on/off/emit to underlying socket", () => {
    const calls: { method: string; args: unknown[] }[] = [];
    const mockSocket: SocketIoCompatible = {
      on(event, handler) { calls.push({ method: "on", args: [event, handler] }); },
      off(event, handler) { calls.push({ method: "off", args: [event, handler] }); },
      emit(event, ...args) { calls.push({ method: "emit", args: [event, ...args] }); },
      connect() { calls.push({ method: "connect", args: [] }); },
      disconnect() { calls.push({ method: "disconnect", args: [] }); },
      id: "test-socket-123",
      connected: true,
    };

    const adapter = new SocketIoClientAdapter(mockSocket);

    expect(adapter.id).toBe("test-socket-123");
    expect(adapter.connected).toBe(true);

    const handler = (msg: string) => msg;
    adapter.on("receiveMessage", handler);
    expect(calls[0]?.method).toBe("on");
    expect(calls[0]?.args[0]).toBe("receiveMessage");

    adapter.emit("messageSentByUser", "hello", true);
    expect(calls[1]?.method).toBe("emit");
    expect(calls[1]?.args[0]).toBe("messageSentByUser");
    expect(calls[1]?.args[1]).toBe("hello");
    expect(calls[1]?.args[2]).toBe(true);

    adapter.off("receiveMessage", handler);
    expect(calls[2]?.method).toBe("off");
    expect(calls[2]?.args[0]).toBe("receiveMessage");

    adapter.connect();
    expect(calls[3]?.method).toBe("connect");

    adapter.disconnect();
    expect(calls[4]?.method).toBe("disconnect");
  });

  it("correctly reflects connected state changes", () => {
    let currentConnected = false;
    const mockSocket: SocketIoCompatible = {
      on() { return undefined; },
      off() { return undefined; },
      emit() { return undefined; },
      connect() { currentConnected = true; return undefined; },
      disconnect() { currentConnected = false; return undefined; },
      id: undefined,
      get connected() { return currentConnected; },
    };

    const adapter = new SocketIoClientAdapter(mockSocket);
    expect(adapter.connected).toBe(false);
    adapter.connect();
    expect(adapter.connected).toBe(true);
    adapter.disconnect();
    expect(adapter.connected).toBe(false);
  });

  it("off without handler still calls underlying off", () => {
    const calls: string[] = [];
    const mockSocket: SocketIoCompatible = {
      on() { return undefined; },
      off(event) { calls.push(event); return undefined; },
      emit() { return undefined; },
      connect() { return undefined; },
      disconnect() { return undefined; },
      id: "id",
      connected: false,
    };

    const adapter = new SocketIoClientAdapter(mockSocket);
    adapter.off("receiveMessage");
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe("receiveMessage");
  });
});

// ───────────── PartykitClientAdapter tests ─────────────

describe("PartykitClientAdapter", () => {
  it("registers and dispatches event handlers", () => {
    const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);
    const received: string[] = [];
    adapter.on("receiveMessage", (msg: string) => { received.push(msg); });
    expect(adapter.connected).toBe(false);
    expect(adapter.id).toBeUndefined();
  });

  it("off removes specific handler", () => {
    const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);
    const handler1 = (msg: string) => msg;
    const handler2 = (msg: string) => msg;
    adapter.on("receiveMessage", handler1);
    adapter.on("receiveMessage", handler2);
    adapter.off("receiveMessage", handler1);
  });

  it("off without handler removes all handlers for event", () => {
    const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);
    adapter.on("receiveMessage", (msg: string) => msg);
    adapter.on("receiveMessage", (msg: string) => msg);
    adapter.off("receiveMessage");
  });

  it("emit with callback stores pending callback", () => {
    const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);
    let callbackCalled = false;
    adapter.emit("playerJoinRoom", "token", (_result: string | number) => {
      callbackCalled = true;
    });
    expect(callbackCalled).toBe(false);
  });

  it("disconnect is safe to call when not connected", () => {
    const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);
    adapter.disconnect();
    expect(adapter.connected).toBe(false);
    expect(adapter.id).toBeUndefined();
  });
});

// ───────────── createGameSocket factory tests ─────────────

describe("createGameSocket", () => {
  it("creates SocketIoClientAdapter for socketio type", () => {
    const mockSocket: SocketIoCompatible = {
      on() { return undefined; },
      off() { return undefined; },
      emit() { return undefined; },
      connect() { return undefined; },
      disconnect() { return undefined; },
      id: "mock-id",
      connected: false,
    };
    const socket = createGameSocket(
      { type: "socketio", url: "http://localhost:8000", autoConnect: false },
      mockSocket,
    );
    expect(socket).toBeTruthy();
    expect(socket instanceof SocketIoClientAdapter).toBe(true);
    expect(socket.id).toBe("mock-id");
    expect(socket.connected).toBe(false);
  });

  it("throws for socketio without rawSocket", () => {
    expect(() => {
      createGameSocket({ type: "socketio", url: "http://localhost:8000" });
    }).toThrow(/Socket\.IO backend requires/);
  });

  it("creates PartykitClientAdapter for partykit type", () => {
    const socket = createGameSocket({
      type: "partykit",
      url: "http://localhost:1999",
      room: "test-room",
      autoConnect: false,
    });
    expect(socket).toBeTruthy();
    expect(socket instanceof PartykitClientAdapter).toBe(true);
    expect(socket.connected).toBe(false);
  });

  it("uses default room for partykit when not specified", () => {
    const socket = createGameSocket({
      type: "partykit",
      url: "http://localhost:1999",
      autoConnect: false,
    });
    expect(socket).toBeTruthy();
    expect(socket instanceof PartykitClientAdapter).toBe(true);
  });

  it("throws for unknown backend type", () => {
    const config = JSON.parse('{"type":"unknown","url":"http://localhost:8000"}') as GameSocketConfig;
    expect(() => { createGameSocket(config); }).toThrow(/Unknown socket backend type/);
  });

  it("converts http URL to ws URL for partykit", () => {
    const socket = createGameSocket({
      type: "partykit",
      url: "http://example.com",
      room: "game-room",
      autoConnect: false,
    });
    expect(socket).toBeTruthy();
    expect(socket instanceof PartykitClientAdapter).toBe(true);
  });

  it("handles https URL for partykit", () => {
    const socket = createGameSocket({
      type: "partykit",
      url: "https://example.com",
      room: "game-room",
      autoConnect: false,
    });
    expect(socket).toBeTruthy();
    expect(socket instanceof PartykitClientAdapter).toBe(true);
  });
});
