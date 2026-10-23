import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { createBotRunner } from "../../../shared/ai/partyRunner.mjs";

async function flush(t, milliseconds = 1000) {
  t.mock.timers.tick(milliseconds);
  await new Promise(setImmediate);
}
function fixture(t, count = 1, runTurn = mock.fn(async () => {})) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const sockets = [];
  const report = mock.fn();
  class Socket {
    static OPEN = 1;
    readyState = 1;
    listeners = new Map();
    send = mock.fn();
    constructor(url) {
      this.url = url;
      sockets.push(this);
    }
    on(name, listener) {
      this.listeners.set(name, listener);
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
  const runner = createBotRunner({
    WebSocket: Socket,
    randomUUID: () => "opaque",
    generate: async () => "",
    runTurn,
    report,
  });
  const group = runner.startBotSeats({
    url: "https://game.example",
    room: "private room",
    captcha: "",
    tickets: Array.from({ length: count }, (_, index) => `ticket-${index}`),
    model: "available",
    mode: "per-character",
    personality: "varied",
    difficulty: "standard",
  });
  t.after(() => group.stop());
  return { sockets, group, report, runTurn, runner };
}
const snapshot = (patch = {}) => ({
  playerName: "Alice",
  matchId: "first",
  phaseVersion: 1,
  time: "Day",
  canTalk: true,
  canVote: true,
  players: [
    { name: "Alice", isAlive: true },
    { name: "Bob", isAlive: true },
  ],
  ...patch,
});

test("the default runner executes inference, validates actions and submits them through native frames", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let socket;
  class Socket {
    static OPEN = 1;
    readyState = 1;
    listeners = new Map();
    send = mock.fn();
    constructor() {
      socket = this;
    }
    on(name, listener) {
      this.listeners.set(name, listener);
    }
    close() {
      this.readyState = 3;
    }
  }
  const generate = mock.fn(async () =>
    JSON.stringify({
      characters: [
        { playerName: "Alice", actions: [{ kind: "chat", message: "hello" }] },
      ],
    }),
  );
  const runner = createBotRunner({
    WebSocket: Socket,
    randomUUID: () => "id",
    generate,
  });
  const options = {
    url: "http://localhost:1999",
    room: "room",
    tickets: ["ticket"],
    mode: "shared",
    model: "model",
    personality: "cautious",
    difficulty: "casual",
  };
  for (const patch of [
    { mode: "unknown" },
    { personality: "unknown" },
    { difficulty: "unknown" },
  ])
    assert.throws(() => runner.startBotSeats({ ...options, ...patch }));
  const group = runner.startBotSeats(options);
  t.after(() => group.stop());
  socket.listeners.get("message")(
    JSON.stringify({
      type: "callback",
      args: [{ status: "joined", username: "Alice" }],
    }),
  );
  socket.listeners.get("message")(
    JSON.stringify({
      type: "event",
      event: "game-snapshot",
      args: [snapshot()],
    }),
  );
  await flush(t);
  assert.equal(generate.mock.callCount(), 1);
  assert.ok(
    socket.send.mock.calls.some(
      (call) => JSON.parse(call.arguments[0]).event === "messageSentByUser",
    ),
  );
});

test("chat and whispers debounce new reactions without issuing duplicate phase turns", async (t) => {
  const f = fixture(t);
  const socket = f.sockets[0];
  socket.receive("game-snapshot", snapshot());
  await flush(t);
  socket.receive("receive-chat-message", "public");
  await flush(t, 4900);
  assert.equal(f.runTurn.mock.callCount(), 1);
  socket.receive("receive-whisper-message", "private");
  await flush(t, 4999);
  assert.equal(f.runTurn.mock.callCount(), 1);
  await flush(t, 1);
  assert.equal(f.runTurn.mock.callCount(), 2);
  assert.equal(
    f.runTurn.mock.calls[1].arguments[0].characters[0].observations.at(-1).data,
    "private",
  );
});

test("a pending phase update runs after the in-flight decision and rejects its stale action", async (t) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  let turns = 0;
  const runTurn = mock.fn(async ({ characters }) => {
    if (++turns === 1) await pending;
    characters[0].socket.emit(
      "messageSentByUser",
      turns === 1 ? "stale" : "current",
      "Day",
    );
  });
  const f = fixture(t, 1, runTurn);
  const socket = f.sockets[0];
  socket.receive("game-snapshot", snapshot());
  await flush(t);
  socket.receive("game-snapshot", snapshot({ phaseVersion: 2 }));
  await flush(t);
  assert.equal(turns, 1);
  release();
  await new Promise(setImmediate);
  assert.equal(turns, 2);
  const actions = socket.send.mock.calls.map((call) =>
    JSON.parse(call.arguments[0]),
  );
  assert.equal(
    actions.some(({ args }) => args.includes("stale")),
    false,
  );
  assert.equal(
    actions.filter(({ args }) => args.includes("current")).length,
    1,
  );
});

test("native socket frames carry signed joins, phase versions and command IDs", async (t) => {
  const f = fixture(t);
  const socket = f.sockets[0];
  assert.match(
    socket.url,
    /^wss:\/\/game.example\/parties\/main\/private%20room\?resume=/,
  );
  socket.listeners.get("open")();
  const joined = JSON.parse(socket.send.mock.calls[0].arguments[0]);
  assert.deepEqual(joined.args, ["", "ticket-0"]);
  assert.equal(joined.event, "playerJoinRoom");
  assert.equal(joined.commandId, undefined);
  socket.receive("game-snapshot", snapshot());
  await flush(t);
  f.group[0].emit("messageSentByUser", "hello", "Day");
  const action = JSON.parse(socket.send.mock.calls.at(-1).arguments[0]);
  assert.equal(action.commandId, "opaque");
  assert.equal(action.phaseVersion, 1);
  socket.readyState = 3;
  const count = socket.send.mock.callCount();
  f.group[0].emit("messageSentByUser", "blocked", "Day");
  assert.equal(socket.send.mock.callCount(), count);
});
test("partial rosters and mixed match IDs never combine private views", async (t) => {
  const f = fixture(t, 2);
  f.sockets[0].receive("game-snapshot", snapshot());
  await flush(t);
  assert.equal(f.runTurn.mock.callCount(), 0);
  await flush(t);
  assert.equal(f.runTurn.mock.callCount(), 0);
  f.sockets[1].receive(
    "game-snapshot",
    snapshot({ playerName: "Bob", matchId: "other" }),
  );
  await flush(t);
  assert.equal(f.runTurn.mock.callCount(), 0);
  await flush(t);
  assert.equal(f.runTurn.mock.callCount(), 0);
  f.sockets[1].receive("game-snapshot", snapshot({ playerName: "Bob" }));
  await flush(t);
  assert.equal(f.runTurn.mock.callCount(), 1);
  assert.deepEqual(
    f.runTurn.mock.calls[0].arguments[0].characters.map(
      ({ snapshot }) => snapshot.playerName,
    ),
    ["Alice", "Bob"],
  );
});
test("roster, role and phase updates remain player-scoped and observation history stays bounded", async (t) => {
  const f = fixture(t);
  const socket = f.sockets[0];
  socket.receive("game-snapshot", snapshot());
  for (let i = 0; i < 100; i++)
    socket.receive("receiveMessage", `message-${i}`);
  socket.receive("receive-player-list", [
    { name: "Alice", isAlive: true },
    { name: "Bob", isAlive: true },
  ]);
  socket.receive("update-player-role", { name: "Bob", role: "Doctor" });
  socket.receive("update-day-time", {
    time: "Night",
    dayNumber: 1,
    timeLeft: 30,
    phaseVersion: 2,
  });
  await flush(t);
  const character = f.runTurn.mock.calls[0].arguments[0].characters[0];
  assert.equal(character.observations.length, 80);
  assert.equal(character.snapshot.time, "Night");
  assert.equal(character.snapshot.players[1].role, "Doctor");
  assert.equal(character.snapshot.players[1].isAlive, false);
  assert.equal(character.snapshot.phaseVersion, 2);
});
test("finished matches ready once for rematch and reset private history on the next round", async (t) => {
  const f = fixture(t);
  const socket = f.sockets[0];
  socket.receive("game-snapshot", snapshot());
  f.group[0].conversation.push({
    role: "user",
    content: "prior private memory",
  });
  socket.receive("receive-role", "old role");
  socket.receive("game-snapshot", snapshot({ ended: true }));
  socket.receive("game-snapshot", snapshot({ ended: true }));
  await flush(t);
  assert.equal(f.runTurn.mock.callCount(), 0);
  assert.equal(
    socket.send.mock.calls
      .map((call) => JSON.parse(call.arguments[0]))
      .filter(({ event }) => event === "readyForRematch").length,
    1,
  );
  socket.receive("game-snapshot", snapshot({ matchId: "second" }));
  await flush(t);
  assert.deepEqual(f.group[0].conversation, []);
  assert.deepEqual(f.group[0].observations, []);
  assert.equal(f.runTurn.mock.callCount(), 1);
});
test("obsolete, duplicate-vote, dead and ended decisions cannot submit commands", async (t) => {
  const f = fixture(t);
  const socket = f.sockets[0];
  socket.receive("game-snapshot", snapshot({ action: { vote: 0 } }));
  await flush(t);
  const before = socket.send.mock.callCount();
  f.group[0].emit("handleVote", 1, "Day");
  socket.receive("update-day-time", { time: "Night", phaseVersion: 2 });
  f.group[0].emit("handleVisit", 1, "Night");
  assert.equal(socket.send.mock.callCount(), before);
  socket.receive(
    "game-snapshot",
    snapshot({ players: [{ name: "Alice", isAlive: false }] }),
  );
  await flush(t);
  f.group[0].emit("messageSentByUser", "dead", "Day");
  assert.equal(socket.send.mock.callCount(), before);
  socket.receive("game-snapshot", snapshot({ ended: true }));
  const afterRematch = socket.send.mock.callCount();
  f.group[0].emit("messageSentByUser", "ended", "Day");
  assert.equal(socket.send.mock.callCount(), afterRematch);
});
test("malformed frames and rejected joins are contained, reported, and closed", async (t) => {
  const f = fixture(t);
  const socket = f.sockets[0];
  socket.listeners.get("message")("invalid");
  socket.listeners.get("message")("{}");
  socket.listeners.get("error")(new Error("offline"));
  socket.listeners.get("message")(
    JSON.stringify({ type: "command-ack", accepted: false, reason: "phase" }),
  );
  socket.listeners.get("message")(
    JSON.stringify({
      type: "callback",
      args: [{ status: "joined", username: "Alice" }],
    }),
  );
  socket.listeners.get("message")(
    JSON.stringify({
      type: "callback",
      args: [{ status: "rejected", code: "expired" }],
    }),
  );
  await flush(t);
  assert.equal(f.group[0].closed, true);
  assert.equal(f.runTurn.mock.callCount(), 0);
  assert.ok(
    f.report.mock.calls.some((call) => call.arguments[0].includes("expired")),
  );
});
test("stopping a group prevents queued and later model work", async (t) => {
  const f = fixture(t);
  const close = t.mock.method(f.sockets[0], "close");
  f.sockets[0].receive("game-snapshot", snapshot());
  f.group.stop();
  assert.deepEqual(close.mock.calls[0].arguments, [1000, "Client disconnected"]);
  await flush(t, 6000);
  assert.equal(f.runTurn.mock.callCount(), 0);
});
test("model failures are contained and stop does not schedule another turn", async (t) => {
  const runTurn = mock.fn(async () => {
    throw new Error("model unavailable");
  });
  const f = fixture(t, 1, runTurn);
  f.sockets[0].receive("game-snapshot", snapshot());
  await flush(t);
  f.group.stop();
  await flush(t, 6000);
  assert.equal(runTurn.mock.callCount(), 1);
  assert.ok(
    f.report.mock.calls.some((call) =>
      call.arguments[0].includes("model unavailable"),
    ),
  );
});
