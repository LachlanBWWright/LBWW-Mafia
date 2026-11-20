import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createBotRunner } from "../../../shared/ai/partyRunner.mjs";
import { runCharacterTurn } from "../../../shared/ai/characterDecisions.mjs";

const snapshot = (name = "Alice", patch = {}) => ({
  playerName: name,
  matchId: "match",
  phaseVersion: 1,
  time: "Day",
  dayNumber: 1,
  canTalk: true,
  canVote: false,
  players: [
    { name: "Alice", isAlive: true },
    { name: "Bob", isAlive: true },
  ],
  ...patch,
});
const response = (names, message = "Who do you suspect?") =>
  JSON.stringify({
    characters: names.map((playerName) => ({
      playerName,
      actions: [{ kind: "chat", message }],
    })),
  });
const namesFor = (input) =>
  JSON.parse(input.input.at(-1).content).characters.map(
    (entry) => entry.snapshot.playerName,
  );
const settle = async () => {
  for (let index = 0; index < 5; index++) await new Promise(setImmediate);
};
function fixture(
  t,
  { mode = "per-character", count = 1, generate, limits } = {},
) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const sockets = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    listeners = new Map();
    frames = [];
    constructor() {
      sockets.push(this);
    }
    on(event, listener) {
      this.listeners.set(event, listener);
    }
    send(raw) {
      this.frames.push(JSON.parse(raw));
    }
    close() {
      this.readyState = 3;
      this.listeners.get("close")?.();
    }
    receive(event, payload) {
      this.listeners.get("message")(
        JSON.stringify({ type: "event", event, args: [payload] }),
      );
    }
  }
  const report = mock.fn();
  const runner = createBotRunner({
    WebSocket: Socket,
    randomUUID: () => "id",
    generate,
    limits,
    report,
  });
  const group = runner.startBotSeats({
    url: "http://localhost:1999",
    room: "room",
    tickets: Array(count).fill("ticket"),
    model: "model",
    mode,
  });
  t.after(() => group.stop());
  const tick = async (ms = 1000) => {
    t.mock.timers.tick(ms);
    await settle();
  };
  return { runner, group, sockets, report, tick };
}

for (const mode of ["shared", "per-character"])
  test(`${mode}: phase changes abort obsolete inference without appending stale memory`, async (t) => {
    const calls = [];
    const generate = (input) =>
      new Promise((resolve) => calls.push({ input, resolve }));
    const f = fixture(t, { mode, generate });
    f.sockets[0].receive("game-snapshot", snapshot());
    await f.tick();
    f.sockets[0].receive(
      "game-snapshot",
      snapshot("Alice", { phaseVersion: 2, time: "Night" }),
    );
    assert.equal(calls[0].input.signal.aborted, true);
    await settle();
    await f.tick();
    assert.equal(calls.length, 2);
    calls[1].resolve(response(["Alice"], "Current decision?"));
    await settle();
    calls[0].resolve(response(["Alice"], "Obsolete decision?"));
    await settle();
    const frames = f.sockets[0].frames.filter(
      (frame) => frame.event === "messageSentByUser",
    );
    assert.deepEqual(
      frames.map((frame) => frame.args[0]),
      ["Current decision?"],
    );
    assert.equal(
      JSON.stringify(f.group[0].conversation).includes("Obsolete"),
      false,
    );
  });

for (const event of [
  "game-snapshot",
  "receive-player-list",
  "update-player-role",
])
  test(`own death via ${event} cancels inference`, async (t) => {
    let signal;
    const f = fixture(t, {
      generate: async (input) => {
        signal = input.signal;
        return new Promise(() => {});
      },
    });
    f.sockets[0].receive("game-snapshot", snapshot());
    await f.tick();
    const players = snapshot().players.map((player) => ({
      ...player,
      isAlive: player.name !== "Alice",
    }));
    f.sockets[0].receive(
      event,
      event === "game-snapshot"
        ? snapshot("Alice", { players })
        : event === "receive-player-list"
          ? players
          : { name: "Alice", role: "Doctor" },
    );
    assert.equal(signal.aborted, true);
    await settle();
    assert.equal(f.sockets[0].frames.length, 0);
    assert.deepEqual(f.group[0].conversation, []);
  });

for (const action of ["stop", "seat-close", "disconnect", "pause"])
  test(`${action} cancels in-flight generation`, async (t) => {
    let signal;
    const f = fixture(t, {
      generate: async (input) => {
        signal = input.signal;
        return new Promise(() => {});
      },
    });
    f.sockets[0].receive("game-snapshot", snapshot());
    await f.tick();
    if (action === "stop") f.group.stop();
    if (action === "seat-close") f.group[0].close();
    if (action === "disconnect") f.sockets[0].listeners.get("close")();
    if (action === "pause") f.runner.setPaused(true);
    assert.equal(signal.aborted, true);
    await settle();
    assert.equal(f.sockets[0].frames.length, 0);
  });

test("one bot dying cancels a shared request and surviving bots receive a fresh request", async (t) => {
  const calls = [];
  const f = fixture(t, {
    mode: "shared",
    count: 2,
    generate: (input) =>
      new Promise((resolve) => calls.push({ input, resolve })),
  });
  f.sockets[0].receive("game-snapshot", snapshot());
  f.sockets[1].receive("game-snapshot", snapshot("Bob"));
  await f.tick();
  f.sockets[0].receive(
    "game-snapshot",
    snapshot("Alice", {
      players: [
        { name: "Alice", isAlive: false },
        { name: "Bob", isAlive: true },
      ],
    }),
  );
  assert.equal(calls[0].input.signal.aborted, true);
  await settle();
  await f.tick();
  assert.deepEqual(namesFor(calls[1].input), ["Bob"]);
  calls[1].resolve(response(["Bob"]));
  await settle();
  assert.equal(f.sockets[1].frames.length, 1);
  assert.equal(f.sockets[0].frames.length, 0);
});

test("per-character death does not cancel or regenerate a surviving character's request", async (t) => {
  const calls = [];
  const f = fixture(t, {
    count: 2,
    generate: (input) =>
      new Promise((resolve) => calls.push({ input, resolve })),
  });
  f.sockets[0].receive("game-snapshot", snapshot());
  f.sockets[1].receive("game-snapshot", snapshot("Bob"));
  await f.tick();
  f.sockets[0].receive(
    "game-snapshot",
    snapshot("Alice", { players: [{ name: "Alice", isAlive: false }] }),
  );
  assert.equal(calls[0].input.signal.aborted, true);
  assert.equal(calls[1].input.signal.aborted, false);
  calls[1].resolve(response(["Bob"]));
  await settle();
  await f.tick();
  assert.equal(calls.length, 2);
  assert.equal(f.sockets[1].frames.length, 1);
});

test("successful character actions are submitted before a slow peer completes, and peer errors are isolated", async () => {
  let rejectAlice;
  const characters = ["Alice", "Bob"].map((name) => ({
    snapshot: snapshot(name),
    observations: [],
    conversation: [],
    socket: { emit: mock.fn() },
  }));
  const errors = mock.fn();
  const turn = runCharacterTurn({
    model: "model",
    mode: "per-character",
    characters,
    onError: errors,
    generate: (input) =>
      namesFor(input)[0] === "Alice"
        ? new Promise((_, reject) => {
            rejectAlice = reject;
          })
        : Promise.resolve(response(["Bob"])),
  });
  await settle();
  assert.equal(characters[1].socket.emit.mock.callCount(), 1);
  rejectAlice(new Error("Alice failed"));
  assert.deepEqual(
    (await turn).map((decision) => decision.playerName),
    ["Bob"],
  );
  assert.equal(errors.mock.calls[0].arguments[1], "Alice");
  assert.equal(characters[0].conversation.length, 0);
  assert.equal(characters[1].conversation.length, 2);
});

test("malformed output for one character cannot suppress a valid peer action", async () => {
  const errors = mock.fn();
  const characters = ["Alice", "Bob"].map((name) => ({
    snapshot: snapshot(name),
    observations: [],
    conversation: [],
    socket: { emit: mock.fn() },
  }));
  const decisions = await runCharacterTurn({
    model: "model",
    mode: "per-character",
    characters,
    onError: errors,
    generate: async (input) =>
      namesFor(input)[0] === "Alice" ? "invalid JSON" : response(["Bob"]),
  });
  assert.equal(decisions.length, 1);
  assert.equal(characters[1].socket.emit.mock.callCount(), 1);
  assert.equal(errors.mock.callCount(), 1);
});

test("shared limits also govern raw subscription-style generation and explicit retry preserves the budget", async (t) => {
  let failure = true;
  const generate = mock.fn(async (input) => {
    if (failure)
      throw Object.assign(new Error("limited"), { code: "usage-limit" });
    assert.equal(input.maxOutputTokens, 128);
    return response(namesFor(input));
  });
  const f = fixture(t, {
    generate,
    limits: { maxRequests: 2, maxOutputTokens: 128 },
  });
  f.sockets[0].receive("game-snapshot", snapshot());
  await f.tick();
  failure = false;
  f.runner.retry();
  await f.tick();
  assert.equal(f.sockets[0].frames.length, 1);
  f.group.retry();
  await f.tick();
  assert.equal(generate.mock.callCount(), 2);
  assert.equal(
    f.report.mock.calls.some((call) => call.arguments[0].includes("budget")),
    true,
  );
});

test("direct per-character callers can omit an error callback and still receive valid peer decisions", async () => {
  const { decideCharacterActions } =
    await import("../../../shared/ai/characterDecisions.mjs");
  const characters = ["Alice", "Bob"].map((name) => ({
    snapshot: snapshot(name),
    observations: [],
    conversation: [],
  }));
  const decisions = await decideCharacterActions({
    model: "model",
    mode: "per-character",
    characters,
    generate: async (input) =>
      namesFor(input)[0] === "Alice" ? "invalid JSON" : response(["Bob"]),
  });
  assert.deepEqual(
    decisions.map((decision) => decision.playerName),
    ["Bob"],
  );
});

test("a subscription stream stalled in its body reader is cancelled and released", async () => {
  const { completedText } = await import("../../../shared/ai/inference.mjs");
  const cancel = mock.fn();
  const response = new Response(new ReadableStream({ start() {}, cancel }));
  const controller = new AbortController();
  const pending = completedText(response, controller.signal);
  await settle();
  controller.abort();
  await assert.rejects(pending, (error) => error.name === "AbortError");
  assert.equal(cancel.mock.callCount(), 1);
});
