import { afterEach, expect, it, vi } from "vitest";
import { PartykitClientAdapter } from "./partykitClientAdapter";
import { ClientEvent, DayTime } from "./events";
class Socket {
  static OPEN = 1;
  static CONNECTING = 0;
  static instances: Socket[] = [];
  readyState = 0;
  onopen?: () => void;
  onclose?: () => void;
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
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Socket.instances = [];
});
it("reconnects with the same secret, rejoins, delivers fresh acknowledgements, and stops on cleanup", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const adapter = new PartykitClientAdapter(
    "ws://test/parties/main/game",
    false,
  );
  const callback = vi.fn();
  adapter.connect(() =>
    adapter.emit(ClientEvent.PlayerJoinRoom, "captcha", "ticket", callback),
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
});

it("retries unacknowledged actions with the same ID and stops after acknowledgement", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const adapter = new PartykitClientAdapter("ws://test/game", false);
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
