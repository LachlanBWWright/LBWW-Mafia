import { describe, it, expect } from "vitest";
import { SocketIoClientAdapter, type SocketIoCompatible } from "./socketIoClientAdapter";
import { PartykitClientAdapter } from "./partykitClientAdapter";
import { createGameSocket } from "./createGameSocket";
import type { GameSocketConfig } from "./clientTypes";
import {
  ClientEvent,
  DayTime,
  JoinRoomResultCode,
  PartyKitMessageType,
  ServerEvent,
} from "./events";
import { MessageKey } from "./messages";
import {
  type SupabaseChannelLike,
  SupabaseRealtimeClientAdapter,
} from "./supabaseRealtimeClientAdapter";
import {
  SUPABASE_CONTROL_CHANNEL,
  SUPABASE_CONTROL_EVENT,
  SUPABASE_DELIVERY_EVENT,
  createSupabaseRoomChannelName,
  createSupabaseSocketChannelName,
} from "./supabaseRealtime";

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

    const handler = () => undefined;
    adapter.on(ServerEvent.ReceiveMessage, handler);
    expect(calls[0]?.method).toBe("on");
    expect(calls[0]?.args[0]).toBe(ServerEvent.ReceiveMessage);

    adapter.emit(ClientEvent.MessageSentByUser, "hello", DayTime.Day);
    expect(calls[1]?.method).toBe("emit");
    expect(calls[1]?.args[0]).toBe(ClientEvent.MessageSentByUser);
    expect(calls[1]?.args[1]).toBe("hello");
    expect(calls[1]?.args[2]).toBe(DayTime.Day);

    adapter.off(ServerEvent.ReceiveMessage, handler);
    expect(calls[2]?.method).toBe("off");
    expect(calls[2]?.args[0]).toBe(ServerEvent.ReceiveMessage);

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
    adapter.off(ServerEvent.ReceiveMessage);
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe(ServerEvent.ReceiveMessage);
  });
});

// ───────────── PartykitClientAdapter tests ─────────────

describe("PartykitClientAdapter", () => {
  it("registers and dispatches event handlers", () => {
    const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);
    const received: string[] = [];
    adapter.on(ServerEvent.ReceiveMessage, (msg) => { received.push(msg.key); });
    expect(adapter.connected).toBe(false);
    expect(adapter.id).toBeUndefined();
  });

  it("off removes specific handler", () => {
    const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);
    const handler1 = () => undefined;
    const handler2 = () => undefined;
    adapter.on(ServerEvent.ReceiveMessage, handler1);
    adapter.on(ServerEvent.ReceiveMessage, handler2);
    adapter.off(ServerEvent.ReceiveMessage, handler1);
  });

  it("off without handler removes all handlers for event", () => {
    const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);
    adapter.on(ServerEvent.ReceiveMessage, () => undefined);
    adapter.on(ServerEvent.ReceiveMessage, () => undefined);
    adapter.off(ServerEvent.ReceiveMessage);
  });

  it("emit with callback stores pending callback", () => {
    const adapter = new PartykitClientAdapter("ws://localhost:9999/party/test", false);
    let callbackCalled = false;
    adapter.emit(ClientEvent.PlayerJoinRoom, "token", (_result) => {
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

type BroadcastCallback = (payload: { payload: unknown }) => void;

class MockSupabaseChannel implements SupabaseChannelLike {
  readonly handlers = new Map<string, BroadcastCallback[]>();
  readonly sent: Array<{ type: "broadcast"; event: string; payload: unknown }> = [];
  subscribeCallback?: (status: string) => void;
  unsubscribed = false;

  on(
    _type: "broadcast",
    filter: { event: string },
    callback: BroadcastCallback,
  ): MockSupabaseChannel {
    const handlers = this.handlers.get(filter.event) ?? [];
    handlers.push(callback);
    this.handlers.set(filter.event, handlers);
    return this;
  }

  subscribe(callback?: (status: string) => void): void {
    this.subscribeCallback = callback;
  }

  send(message: { type: "broadcast"; event: string; payload: unknown }): void {
    this.sent.push(message);
  }

  unsubscribe(): void {
    this.unsubscribed = true;
  }

  emit(event: string, payload: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler({ payload });
    }
  }
}

describe("SupabaseRealtimeClientAdapter", () => {
  it("sends control messages and receives targeted callbacks/events", () => {
    const channels = new Map<string, MockSupabaseChannel>();
    const client = {
      channel(name: string) {
        const existing = channels.get(name);
        if (existing) {
          return existing;
        }
        const channel = new MockSupabaseChannel();
        channels.set(name, channel);
        return channel;
      },
      removeChannel() {
        return undefined;
      },
    };

    const adapter = new SupabaseRealtimeClientAdapter(
      client,
      "fixture-room",
      false,
      "sb_fixture",
    );
    let joined = false;
    const received: string[] = [];
    adapter.on(ServerEvent.ReceiveChatMessage, (message) => {
      received.push(message);
    });
    adapter.connect();

    channels.get(SUPABASE_CONTROL_CHANNEL)?.subscribeCallback?.("SUBSCRIBED");
    channels.get(createSupabaseRoomChannelName("fixture-room"))?.subscribeCallback?.(
      "SUBSCRIBED",
    );
    channels.get(createSupabaseSocketChannelName("sb_fixture"))?.subscribeCallback?.(
      "SUBSCRIBED",
    );

    adapter.emit(ClientEvent.PlayerJoinRoom, "token", () => {
      joined = true;
    });

    expect(channels.get(SUPABASE_CONTROL_CHANNEL)?.sent[0]).toMatchObject({
      event: SUPABASE_CONTROL_EVENT,
      payload: {
        roomId: "fixture-room",
        socketId: "sb_fixture",
      },
    });

    channels.get(createSupabaseSocketChannelName("sb_fixture"))?.emit(
      SUPABASE_DELIVERY_EVENT,
      {
        type: PartyKitMessageType.Callback,
        callbackId: "cb_1",
        args: [{ status: "joined", username: "alpha" }],
      },
    );
    channels.get(createSupabaseRoomChannelName("fixture-room"))?.emit(
      SUPABASE_DELIVERY_EVENT,
      {
        type: PartyKitMessageType.Event,
        event: ServerEvent.ReceiveChatMessage,
        args: ["hello from room"],
      },
    );

    expect(joined).toBe(true);
    expect(received).toEqual(["hello from room"]);
    expect(adapter.connected).toBe(true);
    expect(adapter.id).toBe("sb_fixture");
  });

  it("disconnect sends a synthetic disconnect event and unsubscribes channels", () => {
    const channels = new Map<string, MockSupabaseChannel>();
    const client = {
      channel(name: string) {
        const existing = channels.get(name);
        if (existing) {
          return existing;
        }
        const channel = new MockSupabaseChannel();
        channels.set(name, channel);
        return channel;
      },
      removeChannel() {
        return undefined;
      },
    };

    const adapter = new SupabaseRealtimeClientAdapter(
      client,
      "fixture-room",
      false,
      "sb_fixture",
    );
    adapter.connect();
    channels.get(SUPABASE_CONTROL_CHANNEL)?.subscribeCallback?.("SUBSCRIBED");
    channels.get(createSupabaseRoomChannelName("fixture-room"))?.subscribeCallback?.(
      "SUBSCRIBED",
    );
    channels.get(createSupabaseSocketChannelName("sb_fixture"))?.subscribeCallback?.(
      "SUBSCRIBED",
    );

    adapter.disconnect();

    expect(channels.get(SUPABASE_CONTROL_CHANNEL)?.sent.at(-1)).toMatchObject({
      event: SUPABASE_CONTROL_EVENT,
      payload: {
        roomId: "fixture-room",
        socketId: "sb_fixture",
        message: {
          event: ClientEvent.Disconnect,
        },
      },
    });
    expect(channels.get(SUPABASE_CONTROL_CHANNEL)?.unsubscribed).toBe(true);
    expect(channels.get(createSupabaseRoomChannelName("fixture-room"))?.unsubscribed)
      .toBe(true);
    expect(channels.get(createSupabaseSocketChannelName("sb_fixture"))?.unsubscribed)
      .toBe(true);
    expect(adapter.connected).toBe(false);
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
    const socketRes = createGameSocket(
      { type: "socketio", url: "http://localhost:8000", autoConnect: false },
      mockSocket,
    );
    expect(socketRes.isOk()).toBe(true);
    const socket = socketRes.value;
    expect(socket).toBeTruthy();
    expect(socket instanceof SocketIoClientAdapter).toBe(true);
    expect(socket.id).toBe("mock-id");
    expect(socket.connected).toBe(false);
  });

  it("returns Err for socketio without rawSocket", () => {
    const res = createGameSocket({ type: "socketio", url: "http://localhost:8000" });
    expect(res.isErr()).toBe(true);
    expect(res.error.message).toMatch(/Socket\.IO backend requires/);
  });

  it("creates PartykitClientAdapter for partykit type", () => {
    const socketRes = createGameSocket({
      type: "partykit",
      url: "http://localhost:1999",
      room: "test-room",
      autoConnect: false,
    });
    expect(socketRes.isOk()).toBe(true);
    const socket = socketRes.value;
    expect(socket).toBeTruthy();
    expect(socket instanceof PartykitClientAdapter).toBe(true);
    expect(socket.connected).toBe(false);
  });

  it("uses default room for partykit when not specified", () => {
    const socketRes = createGameSocket({
      type: "partykit",
      url: "http://localhost:1999",
      autoConnect: false,
    });
    expect(socketRes.isOk()).toBe(true);
    const socket = socketRes.value;
    expect(socket).toBeTruthy();
    expect(socket instanceof PartykitClientAdapter).toBe(true);
  });

  it("returns Err for unknown backend type", () => {
    const config = JSON.parse('{"type":"unknown","url":"http://localhost:8000"}') as GameSocketConfig;
    const res = createGameSocket(config);
    expect(res.isErr()).toBe(true);
    expect(res.error.message).toMatch(/Unknown socket backend type/);
  });

  it("creates SupabaseRealtimeClientAdapter for supabase type", () => {
    const socketRes = createGameSocket({
      type: "supabase",
      url: "https://example.supabase.co",
      apiKey: "anon-key",
      room: "test-room",
      autoConnect: false,
    });
    expect(socketRes.isOk()).toBe(true);
    expect(socketRes.value instanceof SupabaseRealtimeClientAdapter).toBe(true);
  });

  it("returns Err for supabase without api key", () => {
    const socketRes = createGameSocket({
      type: "supabase",
      url: "https://example.supabase.co",
      room: "test-room",
      autoConnect: false,
    });
    expect(socketRes.isErr()).toBe(true);
    expect(socketRes.error.message).toMatch(/requires an anon\/public API key/i);
  });

  it("converts http URL to ws URL for partykit", () => {
    const socketRes = createGameSocket({
      type: "partykit",
      url: "http://example.com",
      room: "game-room",
      autoConnect: false,
    });
    expect(socketRes.isOk()).toBe(true);
    const socket = socketRes.value;
    expect(socket).toBeTruthy();
    expect(socket instanceof PartykitClientAdapter).toBe(true);
  });

  it("handles https URL for partykit", () => {
    const socketRes = createGameSocket({
      type: "partykit",
      url: "https://example.com",
      room: "game-room",
      autoConnect: false,
    });
    expect(socketRes.isOk()).toBe(true);
    const socket = socketRes.value;
    expect(socket).toBeTruthy();
    expect(socket instanceof PartykitClientAdapter).toBe(true);
  });
});
