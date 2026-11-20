import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { apiConfigFromEnvironment, createApiBotRuntime } from "./runtime.mjs";
import { createProviderBotRuntime } from "../provider-runtime.mjs";
import { ApiProviderError } from "../../../shared/ai/provider.mjs";

const config = {
  provider: "openai",
  model: "test-model",
  apiKey: "never-send-to-players",
};
const options = {
  url: "https://game.example",
  room: "private-room",
  tickets: ["signed-ticket"],
  mode: "per-character",
};
const snapshot = {
  playerName: "Alice",
  matchId: "one",
  phaseVersion: 1,
  time: "Day",
  canTalk: true,
  canVote: false,
  players: [
    { name: "Alice", isAlive: true },
    { name: "Bob", isAlive: true },
  ],
};
const complete = (text) =>
  Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text }],
      },
    ],
  });
function fixture(t, request, provider) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const sockets = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    listeners = new Map();
    frames = [];
    constructor(url) {
      this.url = url;
      sockets.push(this);
    }
    on(name, listener) {
      this.listeners.set(name, listener);
    }
    send(raw) {
      this.frames.push(JSON.parse(raw));
    }
    close() {
      this.readyState = 3;
      this.listeners.get("close")?.();
    }
    receive(value) {
      this.listeners.get("message")(
        JSON.stringify({
          type: "event",
          event: "game-snapshot",
          args: [value],
        }),
      );
    }
  }
  const report = mock.fn();
  const ports = { WebSocket: Socket, randomUUID: () => "id", request, report };
  const runtime = provider
    ? createProviderBotRuntime(provider, ports)
    : createApiBotRuntime(config, ports);
  t.after(() => runtime.close());
  return { runtime, sockets, report };
}
async function decide(t) {
  t.mock.timers.tick(1000);
  for (let index = 0; index < 5; index++) await new Promise(setImmediate);
}

test("environment selection requires an explicit API provider, model and separate key namespace", () => {
  for (const [provider, name] of [
    ["openai", "OPENAI_API_KEY"],
    ["anthropic", "ANTHROPIC_API_KEY"],
    ["openai-compatible", "MAFIA_AI_API_KEY"],
  ]) {
    const value = apiConfigFromEnvironment({
      MAFIA_AI_PROVIDER: provider,
      MAFIA_AI_MODEL: "chosen",
      [name]: "key",
      MAFIA_AI_MAX_REQUESTS: "12",
      MAFIA_AI_MAX_OUTPUT_TOKENS: "512",
      MAFIA_AI_TIMEOUT_MS: "20000",
      MAFIA_AI_MAX_CONCURRENT_REQUESTS: "1",
    });
    assert.equal(value.provider, provider);
    assert.equal(value.apiKey, "key");
    assert.equal(value.maxRequests, 12);
    assert.equal(value.maxOutputTokens, 512);
    assert.equal(value.timeoutMs, 20000);
    assert.equal(value.maxConcurrentRequests, 1);
  }
  assert.throws(
    () => apiConfigFromEnvironment({ OPENAI_API_KEY: "key" }),
    /MAFIA_AI_PROVIDER/,
  );
  assert.throws(
    () =>
      createApiBotRuntime(
        apiConfigFromEnvironment({
          MAFIA_AI_PROVIDER: "openai",
          MAFIA_AI_MODEL: "chosen",
          ANTHROPIC_API_KEY: "wrong-key-namespace",
        }),
      ),
    /API model and API key/,
  );
});

for (const mode of ["shared", "per-character"])
  test(`${mode} API bot seats join with signed tickets and submit validated player-scoped actions`, async (t) => {
    const request = mock.fn(async (_, init) => {
      assert.equal(init.headers.Authorization, "Bearer never-send-to-players");
      assert.equal(init.body.includes("signed-ticket"), false);
      const body = JSON.parse(init.body);
      const context = JSON.parse(body.input.at(-1).content);
      assert.equal(context.characters.length, 1);
      assert.equal(context.characters[0].snapshot.playerName, "Alice");
      return complete(
        JSON.stringify({
          characters: [
            {
              playerName: "Alice",
              actions: [{ kind: "chat", message: "Who do you suspect?" }],
            },
          ],
        }),
      );
    });
    const { runtime, sockets } = fixture(t, request);
    const group = runtime.startBotSeats({ ...options, mode });
    sockets[0].listeners.get("open")();
    assert.deepEqual(sockets[0].frames[0].args, ["", "signed-ticket"]);
    sockets[0].receive(snapshot);
    await decide(t);
    const messages = sockets[0].frames.filter(
      (frame) => frame.event === "messageSentByUser",
    );
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0].args, ["Who do you suspect?", "Day"]);
    assert.equal(
      JSON.stringify(sockets[0].frames).includes(config.apiKey),
      false,
    );
    assert.equal(request.mock.callCount(), 1);
    group.stop();
    assert.equal(sockets[0].readyState, 3);
  });

test("a phase change during an API request discards its stale action", async (t) => {
  let resolve;
  const request = mock.fn(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { runtime, sockets } = fixture(t, request);
  runtime.startBotSeats(options);
  sockets[0].receive(snapshot);
  await decide(t);
  sockets[0].receive({ ...snapshot, phaseVersion: 2 });
  resolve(
    complete(
      JSON.stringify({
        characters: [
          {
            playerName: "Alice",
            actions: [{ kind: "chat", message: "stale" }],
          },
        ],
      }),
    ),
  );
  for (let index = 0; index < 5; index++) await new Promise(setImmediate);
  assert.equal(
    sockets[0].frames.some((frame) => frame.event === "messageSentByUser"),
    false,
  );
});

test("runtime close cancels in-flight paid generation and all bot sockets", async (t) => {
  let signal;
  const request = mock.fn((_, init) => {
    signal = init.signal;
    return new Promise((_, reject) =>
      signal.addEventListener("abort", () => reject(new Error("aborted")), {
        once: true,
      }),
    );
  });
  const { runtime, sockets } = fixture(t, request);
  runtime.startBotSeats(options);
  sockets[0].receive(snapshot);
  await decide(t);
  assert.equal(signal.aborted, false);
  runtime.close();
  assert.equal(signal.aborted, true);
  assert.equal(sockets[0].readyState, 3);
  assert.throws(() => runtime.startBotSeats(options), /closed/);
});

test("paused API failures do not fall back to ChatGPT or send invalid actions", async (t) => {
  const request = mock.fn(
    async () => new Response("secret upstream detail", { status: 429 }),
  );
  const { runtime, sockets, report } = fixture(t, request);
  runtime.startBotSeats(options);
  sockets[0].receive(snapshot);
  await decide(t);
  sockets[0].receive({ ...snapshot, phaseVersion: 2 });
  await decide(t);
  assert.equal(request.mock.callCount(), 1);
  assert.equal(sockets[0].frames.length, 0);
  assert.equal(
    JSON.stringify(report.mock.calls).includes("secret upstream detail"),
    false,
  );
});

test("API seat validation rejects model overrides and invalid tickets before opening sockets", (t) => {
  const { runtime, sockets } = fixture(t, mock.fn());
  for (const patch of [
    { model: "different-model" },
    { tickets: [] },
    { tickets: Array(13).fill("ticket") },
    { tickets: [""] },
    { room: "../other" },
    { url: "https://key:secret@game.example" },
    { url: "https://game.example/path" },
  ])
    assert.throws(
      () => runtime.startBotSeats({ ...options, ...patch }),
      (error) =>
        error instanceof ApiProviderError && error.code === "configuration",
    );
  assert.equal(sockets.length, 0);
});

test("a non-HTTP provider plugs into the bot host without registration or API credentials", async (t) => {
  const request = mock.fn();
  const close = mock.fn();
  const generate = mock.fn(function (input) {
    assert.equal(this.id, "local-sdk");
    assert.equal(input.model, "test-model");
    assert.equal(input.signal.aborted, false);
    const context = JSON.parse(input.input.at(-1).content).characters[0];
    return Promise.resolve(
      JSON.stringify({
        characters: [
          {
            playerName: context.snapshot.playerName,
            actions: [{ kind: "chat", message: "An SDK-backed decision." }],
          },
        ],
      }),
    );
  });
  const provider = { id: "local-sdk", model: "test-model", generate, close };
  const { runtime, sockets } = fixture(t, request, provider);
  runtime.startBotSeats(options);
  sockets[0].receive(snapshot);
  await decide(t);
  assert.equal(request.mock.callCount(), 0);
  assert.equal(generate.mock.callCount(), 1);
  assert.deepEqual(sockets[0].frames[0].args, [
    "An SDK-backed decision.",
    "Day",
  ]);
  runtime.close();
  runtime.close();
  assert.equal(close.mock.callCount(), 1);
});

test("generic provider cancellation works without an optional close method", async (t) => {
  let signal;
  const provider = {
    id: "remote-sdk",
    model: "test-model",
    generate(input) {
      signal = input.signal;
      return new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("cancelled")), {
          once: true,
        }),
      );
    },
  };
  const { runtime, sockets } = fixture(t, mock.fn(), provider);
  runtime.startBotSeats(options);
  sockets[0].receive(snapshot);
  await decide(t);
  runtime.close();
  assert.equal(signal.aborted, true);
  assert.equal(sockets[0].readyState, 3);
});
