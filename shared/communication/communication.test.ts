import assert from "node:assert/strict";
import test from "node:test";
import { SocketIoClientAdapter, type SocketIoCompatible } from "./socketIoClientAdapter";
import { PartykitClientAdapter } from "./partykitClientAdapter";
import { createGameSocket } from "./createGameSocket";
import type { GameSocketConfig } from "./clientTypes";

// ───────────── SocketIoClientAdapter tests ─────────────

test("SocketIoClientAdapter delegates on/off/emit to underlying socket", () => {
  const calls: { method: string; args: unknown[] }[] = [];
  const mockSocket: SocketIoCompatible = {
    on(event, handler) {
      calls.push({ method: "on", args: [event, handler] });
    },
    off(event, handler) {
      calls.push({ method: "off", args: [event, handler] });
    },
    emit(event, ...args) {
      calls.push({ method: "emit", args: [event, ...args] });
    },
    connect() {
      calls.push({ method: "connect", args: [] });
    },
    disconnect() {
      calls.push({ method: "disconnect", args: [] });
    },
    id: "test-socket-123",
    connected: true,
  };

  const adapter = new SocketIoClientAdapter(mockSocket);

  assert.equal(adapter.id, "test-socket-123");
  assert.equal(adapter.connected, true);

  const handler = (msg: string) => msg;
  adapter.on("receiveMessage", handler);
  assert.equal(calls[0]?.method, "on");
  assert.equal(calls[0]?.args[0], "receiveMessage");

  adapter.emit("messageSentByUser", "hello", true);
  assert.equal(calls[1]?.method, "emit");
  assert.equal(calls[1]?.args[0], "messageSentByUser");
  assert.equal(calls[1]?.args[1], "hello");
  assert.equal(calls[1]?.args[2], true);

  adapter.off("receiveMessage", handler);
  assert.equal(calls[2]?.method, "off");
  assert.equal(calls[2]?.args[0], "receiveMessage");

  adapter.connect();
  assert.equal(calls[3]?.method, "connect");

  adapter.disconnect();
  assert.equal(calls[4]?.method, "disconnect");
});

// ───────────── PartykitClientAdapter tests ─────────────

test("PartykitClientAdapter registers and dispatches event handlers", () => {
  const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);

  const received: string[] = [];
  adapter.on("receiveMessage", (msg: string) => {
    received.push(msg);
  });

  assert.equal(adapter.connected, false);
  assert.equal(adapter.id, undefined);
});

test("PartykitClientAdapter off removes specific handler", () => {
  const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);

  const handler1 = (msg: string) => msg;
  const handler2 = (msg: string) => msg;

  adapter.on("receiveMessage", handler1);
  adapter.on("receiveMessage", handler2);
  adapter.off("receiveMessage", handler1);
});

test("PartykitClientAdapter off without handler removes all handlers for event", () => {
  const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);

  adapter.on("receiveMessage", (msg: string) => msg);
  adapter.on("receiveMessage", (msg: string) => msg);
  adapter.off("receiveMessage");
});

test("PartykitClientAdapter emit with callback stores pending callback", () => {
  const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);

  let callbackCalled = false;
  adapter.emit("playerJoinRoom", "token", (_result: string | number) => {
    callbackCalled = true;
  });

  assert.equal(callbackCalled, false);
});

// ───────────── createGameSocket factory tests ─────────────

test("createGameSocket creates SocketIoClientAdapter for socketio type", () => {
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

  assert.ok(socket);
  assert.equal(socket instanceof SocketIoClientAdapter, true);
  assert.equal(socket.id, "mock-id");
  assert.equal(socket.connected, false);
});

test("createGameSocket throws for socketio without io function", () => {
  assert.throws(() => {
    createGameSocket({ type: "socketio", url: "http://localhost:8000" });
  }, /Socket\.IO backend requires/);
});

test("createGameSocket creates PartykitClientAdapter for partykit type", () => {
  const socket = createGameSocket({
    type: "partykit",
    url: "http://localhost:1999",
    room: "test-room",
    autoConnect: false,
  });

  assert.ok(socket);
  assert.equal(socket instanceof PartykitClientAdapter, true);
  assert.equal(socket.connected, false);
});

test("createGameSocket uses default room for partykit when not specified", () => {
  const socket = createGameSocket({
    type: "partykit",
    url: "http://localhost:1999",
    autoConnect: false,
  });

  assert.ok(socket);
  assert.equal(socket instanceof PartykitClientAdapter, true);
});

test("createGameSocket throws for unknown backend type", () => {
  // Parse config at runtime to bypass compile-time type exhaustiveness check
  const config = JSON.parse(
    '{"type":"unknown","url":"http://localhost:8000"}',
  ) as GameSocketConfig;
  assert.throws(() => {
    createGameSocket(config);
  }, /Unknown socket backend type/);
});

// ───────────── SocketIoClientAdapter advanced tests ─────────────

test("SocketIoClientAdapter correctly reflects connected state changes", () => {
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
  assert.equal(adapter.connected, false);

  adapter.connect();
  assert.equal(adapter.connected, true);

  adapter.disconnect();
  assert.equal(adapter.connected, false);
});

test("SocketIoClientAdapter off without handler still calls underlying off", () => {
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
  assert.equal(calls.length, 1);
  assert.equal(calls[0], "receiveMessage");
});

// ───────────── createGameSocket with partykit URL conversion ─────────────

test("createGameSocket converts http URL to ws URL for partykit", () => {
  const socket = createGameSocket({
    type: "partykit",
    url: "http://example.com",
    room: "game-room",
    autoConnect: false,
  });

  assert.ok(socket);
  assert.equal(socket instanceof PartykitClientAdapter, true);
});

test("createGameSocket handles https URL for partykit", () => {
  const socket = createGameSocket({
    type: "partykit",
    url: "https://example.com",
    room: "game-room",
    autoConnect: false,
  });

  assert.ok(socket);
  assert.equal(socket instanceof PartykitClientAdapter, true);
});

// ───────────── PartykitClientAdapter disconnect cleanup ─────────────

test("PartykitClientAdapter disconnect is safe to call when not connected", () => {
  const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);

  adapter.disconnect();
  assert.equal(adapter.connected, false);
  assert.equal(adapter.id, undefined);
});

