import { afterEach, expect, it, vi } from "vitest";
import { PartyServerClientAdapter } from "./partyserverClientAdapter";
import { ClientEvent, DayTime, ServerEvent } from "./events";
import { createGameSocket } from "./createGameSocket";
import { MessageKey } from "./messages";
class Socket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: Socket[] = [];
  readyState = 0;
  onopen?: () => void;
  onclose?: (event: { code?: number; reason?: string }) => void;
  onmessage?: (event: { data: string }) => void;
  sent: string[] = [];
  constructor(readonly url: string) {
    Socket.instances.push(this);
  }
  send(value: string) {
    this.sent.push(value);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  close(code?: number, reason?: string) {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Socket.instances = [];
});

it.each([
  ["https://mafia.example.workers.dev", "wss://mafia.example.workers.dev"],
  ["https://game.example.com/", "wss://game.example.com"],
  ["http://127.0.0.1:1999", "ws://127.0.0.1:1999"],
  ["wss://mafia.example.workers.dev", "wss://mafia.example.workers.dev"],
])("connects to the Worker endpoint %s using the encoded room and resume identity", (url, origin) => {
  vi.stubGlobal("WebSocket", Socket);
  const result = createGameSocket({
    type: "partyserver",
    url,
    room: "friends / café?#",
    resumeKey: "private+resume/identity?&",
    autoConnect: false,
  });
  expect(result.isOk()).toBe(true);
  if (result.isErr()) throw result.error;
  result.value.connect();
  const endpoint = new URL(Socket.instances[0]!.url);
  expect(endpoint.origin).toBe(origin);
  expect(endpoint.pathname).toBe("/parties/main/friends%20%2F%20caf%C3%A9%3F%23");
  expect(endpoint.searchParams.get("resume")).toBe("private+resume/identity?&");
  expect([...endpoint.searchParams.keys()]).toEqual(["resume"]);
  result.value.disconnect();
});

it("routes an omitted room to the default Worker room", () => {
  vi.stubGlobal("WebSocket", Socket);
  const result = createGameSocket({ type: "partyserver", url: "https://mafia.example.workers.dev" });
  if (result.isErr()) throw result.error;
  expect(new URL(Socket.instances[0]!.url).pathname).toBe("/parties/main/default");
  result.value.disconnect();
});

it.each([ClientEvent.PlayerJoinRoom, ClientEvent.SpectatorJoinRoom] as const)(
  "reconnects %s with the same secret and stops on cleanup",
  async (joinEvent) => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", Socket);
    const adapter = new PartyServerClientAdapter(
      "ws://test/parties/main/game",
      false,
    );
    const callback = vi.fn();
    adapter.connect(() =>
      adapter.emit(joinEvent, "captcha", "ticket", callback),
    );
    const first = Socket.instances[0]!;
    first.open();
    first.onmessage?.({
      data: JSON.stringify({
        type: "callback",
        callbackId: "cb_1",
        args: [{ status: "joined", username: "Mira" }],
      }),
    });
    first.close();
    await vi.advanceTimersByTimeAsync(650);
    const second = Socket.instances[1]!;
    expect(second.url).toBe(first.url);
    second.open();
    expect(JSON.parse(second.sent[0]!).args).toEqual(["captcha", "ticket"]);
    expect(JSON.parse(second.sent[0]!).event).toBe(joinEvent);
    second.onmessage?.({
      data: JSON.stringify({
        type: "callback",
        callbackId: "cb_2",
        args: [{ status: "joined", username: "Mira" }],
      }),
    });
    expect(callback).toHaveBeenCalledTimes(2);
    adapter.disconnect();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(Socket.instances).toHaveLength(2);
  },
);

it("retries unacknowledged actions with the same ID and stops after acknowledgement", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const adapter = new PartyServerClientAdapter("ws://test/game", false);
  adapter.connect(() =>
    adapter.emit(
      ClientEvent.PlayerJoinRoom,
      "captcha",
      "ticket",
      () => undefined,
    ),
  );
  const socket = Socket.instances[0]!;
  socket.open();
  adapter.emit(ClientEvent.MessageSentByUser, "hello", DayTime.Day);
  const action = JSON.parse(socket.sent[1]!);
  expect(action.commandId).toBeTypeOf("string");
  await vi.advanceTimersByTimeAsync(2000);
  expect(JSON.parse(socket.sent[2]!).commandId).toBe(action.commandId);
  socket.onmessage?.({
    data: JSON.stringify({
      type: "command-ack",
      commandId: action.commandId,
      accepted: true,
    }),
  });
  const count = socket.sent.length;
  await vi.advanceTimersByTimeAsync(4000);
  expect(socket.sent).toHaveLength(count);
  adapter.disconnect();
});

it("delivers observer chat through its own event and removes listeners", () => {
  vi.stubGlobal("WebSocket", Socket);
  const adapter = new PartyServerClientAdapter(
    "ws://test/parties/main/game",
    false,
  );
  const observer = vi.fn();
  const living = vi.fn();
  adapter.on("receive-spectator-message", observer);
  adapter.on("receive-chat-message", living);
  adapter.connect();
  const socket = Socket.instances[0]!;
  socket.open();
  const event = {
    data: JSON.stringify({
      type: "event",
      event: "receive-spectator-message",
      args: ["Watcher: hello"],
    }),
  };
  socket.onmessage?.(event);
  expect(observer).toHaveBeenCalledWith("Watcher: hello");
  expect(living).not.toHaveBeenCalled();
  adapter.off("receive-spectator-message", observer);
  socket.onmessage?.(event);
  expect(observer).toHaveBeenCalledTimes(1);
  adapter.disconnect();
});

it("does not reconnect a deliberately closed Worker room", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const adapter = new PartyServerClientAdapter("wss://mafia.example.workers.dev/parties/main/game");
  const socket = Socket.instances[0]!;
  socket.open();
  socket.close(1000, "Room closed");
  expect(adapter.connected).toBe(false);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(Socket.instances).toHaveLength(1);
  adapter.disconnect();
});

it("sends a normal WebSocket close on intentional disconnect and does not retry", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const adapter = new PartyServerClientAdapter("wss://mafia.example.workers.dev/parties/main/game");
  const socket = Socket.instances[0]!;
  const close = vi.spyOn(socket, "close");
  socket.open();
  adapter.disconnect();
  expect(close).toHaveBeenCalledExactlyOnceWith(1000, "Client disconnected");
  expect(adapter.connected).toBe(false);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(Socket.instances).toHaveLength(1);
});

it("reconnects after a Worker restart close with the same resume identity", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const adapter = new PartyServerClientAdapter("wss://mafia.example.workers.dev/parties/main/game", true, "same-device-secret");
  Socket.instances[0]!.open();
  Socket.instances[0]!.close(1012, "Service restart");
  await vi.advanceTimersByTimeAsync(650);
  expect(Socket.instances).toHaveLength(2);
  expect(Socket.instances[1]!.url).toBe(Socket.instances[0]!.url);
  adapter.disconnect();
});

it.each([
  ["stale-phase", MessageKey.ActionStale],
  ["invalid-command", MessageKey.ActionNotConfirmed],
])("reports rejected %s commands once and stops retrying them", async (reason, key) => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const adapter = new PartyServerClientAdapter("wss://mafia.example.workers.dev/parties/main/game", false);
  const feedback = vi.fn();
  adapter.on(ServerEvent.ReceiveMessage, feedback);
  adapter.connect(() => adapter.emit(ClientEvent.PlayerJoinRoom, "captcha", "ticket", () => undefined));
  const socket = Socket.instances[0]!;
  socket.open();
  adapter.emit(ClientEvent.MessageSentByUser, "hello", DayTime.Day);
  const command = JSON.parse(socket.sent[1]!) as { commandId: string };
  const acknowledgement = { data: JSON.stringify({ type: "command-ack", commandId: command.commandId, accepted: false, reason }) };
  socket.onmessage?.(acknowledgement);
  socket.onmessage?.(acknowledgement);
  expect(feedback).toHaveBeenCalledExactlyOnceWith({ key });
  await vi.advanceTimersByTimeAsync(8_000);
  expect(socket.sent).toHaveLength(2);
  adapter.disconnect();
});
