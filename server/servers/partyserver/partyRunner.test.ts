import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sockets = vi.hoisted(() => ({
  instances: [] as Array<{
    readyState: number;
    listeners: Map<string, (value: unknown) => void>;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }>,
}));
const runCharacterTurn = vi.hoisted(() => vi.fn());

vi.mock("ws", () => ({
  WebSocket: class MockWebSocket {
    static OPEN = 1;
    readyState = 1;
    listeners = new Map<string, (value: unknown) => void>();
    send = vi.fn();
    close = vi.fn();

    constructor() {
      sockets.instances.push(this);
    }

    on(event: string, listener: (value: unknown) => void) {
      this.listeners.set(event, listener);
      return this;
    }
  },
}));
vi.mock("../../../tools/ai-bots/characterDecisions.mjs", () => ({
  runCharacterTurn,
}));

import {
  CHAT_REACT_DEBOUNCE,
  startBotSeats,
} from "../../../tools/ai-bots/partyRunner.mjs";

beforeEach(() => {
  vi.useFakeTimers();
  sockets.instances.length = 0;
  runCharacterTurn.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("AI runner decision scheduling", () => {
  it("waits five seconds after the latest chat message before reacting", async () => {
    expect(CHAT_REACT_DEBOUNCE).toBe(5_000);
    startBotSeats({
      url: "http://localhost:1999",
      room: "test-room",
      captcha: "signed-bot-seat",
      tickets: ["ticket"],
      mode: "per-character",
      model: "gpt-6-luna",
    });
    const socket = sockets.instances[0]!;
    const receive = socket.listeners.get("message")!;

    receive(
      JSON.stringify({
        type: "event",
        event: "game-snapshot",
        args: [
          {
            playerName: "Alice",
            phaseVersion: 4,
            players: [{ name: "Alice", isAlive: true }],
            time: "Day",
            canTalk: true,
            canVote: true,
          },
        ],
      }),
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runCharacterTurn).toHaveBeenCalledTimes(1);

    const message = (data: string) =>
      receive(
        JSON.stringify({
          type: "event",
          event: "receive-chat-message",
          args: [data],
        }),
      );
    message("Bob: Are we sure about Charlie?");
    await vi.advanceTimersByTimeAsync(3_000);
    message("Charlie: I think Alice is suspicious.");
    await vi.advanceTimersByTimeAsync(CHAT_REACT_DEBOUNCE - 1);
    expect(runCharacterTurn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(runCharacterTurn).toHaveBeenCalledTimes(2);
    expect(
      runCharacterTurn.mock.calls[1]![0].characters[0].observations,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "receive-chat-message",
          data: "Bob: Are we sure about Charlie?",
        }),
        expect.objectContaining({
          event: "receive-chat-message",
          data: "Charlie: I think Alice is suspicious.",
        }),
      ]),
    );
  });
});

it("readies ended seats once and resets private memory for a new round", async () => {
  const seats = startBotSeats({
    url: "http://localhost:1999",
    room: "test-room",
    captcha: "signed-bot-seat",
    tickets: ["ticket"],
    mode: "per-character",
    model: "gpt-6-luna",
    personality: "deceptive",
    difficulty: "casual",
  });
  const seat = seats[0];
  const receive = sockets.instances[0]!.listeners.get("message")!;
  const snapshot = (matchId: string, ended: boolean) =>
    receive(
      JSON.stringify({
        type: "event",
        event: "game-snapshot",
        args: [
          {
            playerName: "Alice",
            matchId,
            ended,
            phaseVersion: 4,
            time: "Day",
            players: [{ name: "Alice", isAlive: true }],
            canTalk: !ended,
            canVote: !ended,
          },
        ],
      }),
    );
  snapshot("round-one", false);
  seat.conversation.push({ role: "user", content: "Old role secret" });
  snapshot("round-one", true);
  snapshot("round-one", true);
  expect(
    sockets.instances[0]!.send.mock.calls.filter(
      ([raw]) => JSON.parse(raw).event === "readyForRematch",
    ),
  ).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1000);
  expect(runCharacterTurn).not.toHaveBeenCalled();
  snapshot("round-two", false);
  expect(seat.conversation).toEqual([]);
  await vi.advanceTimersByTimeAsync(1000);
  expect(runCharacterTurn.mock.calls[0][0].characters[0]).toMatchObject({
    personality: "deceptive",
    difficulty: "casual",
  });
});

it("blocks actions from a previous match even when the phase version repeats", async () => {
  const [seat] = startBotSeats({
    url: "http://localhost:1999",
    room: "test",
    captcha: "",
    tickets: ["ticket"],
    mode: "shared",
    model: "gpt-6-luna",
  });
  const socket = sockets.instances[0]!;
  const receive = socket.listeners.get("message")!;
  const snapshot = (matchId: string, isAlive = true, ended = false) =>
    receive(
      JSON.stringify({
        type: "event",
        event: "game-snapshot",
        args: [
          {
            playerName: "Alice",
            matchId,
            phaseVersion: 1,
            players: [{ name: "Alice", isAlive }],
            ended,
          },
        ],
      }),
    );
  snapshot("first");
  await vi.advanceTimersByTimeAsync(1000);
  seat.emit("messageSentByUser", "Current action", "Day");
  expect(socket.send).toHaveBeenCalledTimes(1);
  snapshot("second");
  seat.emit("messageSentByUser", "Old secret", "Day");
  expect(socket.send).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1000);
  snapshot("second", false);
  seat.emit("messageSentByUser", "Dead action", "Day");
  await vi.advanceTimersByTimeAsync(1000);
  expect(runCharacterTurn).toHaveBeenCalledTimes(2);
  expect(socket.send).toHaveBeenCalledTimes(1);
});

it("serializes requests while a phase decision is in flight", async () => {
  let resolve!: () => void;
  runCharacterTurn.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  startBotSeats({
    url: "http://localhost:1999",
    room: "test",
    captcha: "",
    tickets: ["ticket"],
    mode: "shared",
    model: "gpt-6-luna",
  });
  const receive = sockets.instances[0]!.listeners.get("message")!;
  const snapshot = (phaseVersion: number) =>
    receive(
      JSON.stringify({
        type: "event",
        event: "game-snapshot",
        args: [
          {
            playerName: "Alice",
            matchId: "first",
            phaseVersion,
            players: [{ name: "Alice", isAlive: true }],
          },
        ],
      }),
    );
  snapshot(1);
  await vi.advanceTimersByTimeAsync(1000);
  snapshot(2);
  await vi.advanceTimersByTimeAsync(1000);
  expect(runCharacterTurn).toHaveBeenCalledTimes(1);
  resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(runCharacterTurn).toHaveBeenCalledTimes(2);
  expect(
    runCharacterTurn.mock.calls[1]![0].characters[0].snapshot.phaseVersion,
  ).toBe(2);
});

it("reports rejected protocol acknowledgements", () => {
  const error = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);
  startBotSeats({
    url: "http://localhost:1999",
    room: "test",
    captcha: "",
    tickets: ["ticket"],
    mode: "shared",
    model: "gpt-6-luna",
  });
  sockets.instances[0]!.listeners.get("message")!(
    JSON.stringify({
      type: "command-ack",
      accepted: false,
      reason: "stale-phase",
    }),
  );
  expect(error).toHaveBeenCalledWith("Bot action rejected (stale-phase).\n");
  error.mockRestore();
});

it("preserves shared memory when a seat dies and resets it on rematch", async () => {
  startBotSeats({
    url: "http://localhost:1999",
    room: "test",
    captcha: "",
    tickets: ["alice", "bob"],
    mode: "shared",
    model: "gpt-6-luna",
  });
  const receive = (index: number, matchId: string, bobAlive: boolean) =>
    sockets.instances[index]!.listeners.get("message")!(
      JSON.stringify({
        type: "event",
        event: "game-snapshot",
        args: [
          {
            playerName: index === 0 ? "Alice" : "Bob",
            matchId,
            phaseVersion: 1,
            players: [
              { name: "Alice", isAlive: true },
              { name: "Bob", isAlive: bobAlive },
            ],
          },
        ],
      }),
    );
  receive(0, "first", true);
  receive(1, "first", true);
  await vi.advanceTimersByTimeAsync(1000);
  const memory = runCharacterTurn.mock.calls[0]![0].sharedConversation;
  memory.push({ role: "user", content: "First round clue" });
  receive(0, "first", false);
  receive(1, "first", false);
  await vi.advanceTimersByTimeAsync(1000);
  expect(runCharacterTurn.mock.calls[1]![0].sharedConversation).toBe(memory);
  receive(0, "second", true);
  receive(1, "second", true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(runCharacterTurn.mock.calls[2]![0].sharedConversation).toEqual([]);
});

it("does not mix active snapshots from different matches", async () => {
  startBotSeats({
    url: "http://localhost:1999",
    room: "test",
    captcha: "",
    tickets: ["alice", "bob"],
    mode: "shared",
    model: "gpt-6-luna",
  });
  const receive = (index: number, matchId: string) =>
    sockets.instances[index]!.listeners.get("message")!(
      JSON.stringify({
        type: "event",
        event: "game-snapshot",
        args: [
          {
            playerName: index === 0 ? "Alice" : "Bob",
            matchId,
            phaseVersion: 1,
            players: [
              { name: "Alice", isAlive: true },
              { name: "Bob", isAlive: true },
            ],
          },
        ],
      }),
    );
  receive(0, "second");
  receive(1, "first");
  await vi.advanceTimersByTimeAsync(1000);
  expect(runCharacterTurn).not.toHaveBeenCalled();
  receive(1, "second");
  await vi.advanceTimersByTimeAsync(1000);
  expect(runCharacterTurn).toHaveBeenCalledTimes(1);
});
