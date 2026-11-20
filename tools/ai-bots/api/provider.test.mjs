import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  ApiProviderError,
  createApiProvider,
} from "../../../shared/ai/provider.mjs";
import { runCharacterTurn } from "../../../shared/ai/characterDecisions.mjs";

const config = {
  provider: "openai",
  model: "test-model",
  apiKey: "private-key",
};
const turn = {
  model: "test-model",
  instructions: "Play Mafia.",
  input: [
    { role: "user", content: "my view" },
    { role: "assistant", content: "previous decision" },
    { role: "user", content: "next view" },
  ],
};
const complete = (text = "decision", patch = {}) => ({
  status: "completed",
  output: [
    { type: "reasoning" },
    {
      type: "message",
      status: "completed",
      role: "assistant",
      content: [{ type: "output_text", text }],
    },
  ],
  usage: { input_tokens: 50, output_tokens: 10 },
  ...patch,
});
const errorCode = (code) => (error) =>
  error instanceof ApiProviderError && error.code === code;
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const flush = () => new Promise(setImmediate);

for (const provider of ["openai", "anthropic", "openai-compatible"]) {
  test(`${provider} translates the common bot input and returns completed text`, async () => {
    const usage = mock.fn();
    const request = mock.fn(async (url, init) => {
      assert.equal(init.redirect, "error");
      const body = JSON.parse(init.body);
      assert.equal(body.model, "test-model");
      assert.equal(body.stream, false);
      if (provider === "openai") {
        assert.equal(url, "https://api.openai.com/v1/responses");
        assert.equal(init.headers.Authorization, "Bearer private-key");
        assert.equal(body.store, false);
        assert.equal(body.max_output_tokens, 2048);
        assert.equal(body.instructions, turn.instructions);
        assert.deepEqual(body.input, turn.input);
        return Response.json(complete());
      }
      if (provider === "anthropic") {
        assert.equal(url, "https://api.anthropic.com/v1/messages");
        assert.equal(init.headers["x-api-key"], "private-key");
        assert.equal(init.headers["anthropic-version"], "2023-06-01");
        assert.equal(body.system, turn.instructions);
        assert.equal(body.max_tokens, 2048);
        assert.deepEqual(body.messages, turn.input);
        return Response.json({
          type: "message",
          role: "assistant",
          stop_reason: "end_turn",
          content: [{ type: "text", text: "decision" }],
          usage: { input_tokens: 50, output_tokens: 10 },
        });
      }
      assert.equal(url, "https://custom.example/v1/chat/completions");
      assert.equal(init.headers.Authorization, "Bearer private-key");
      assert.deepEqual(body.messages, [
        { role: "system", content: turn.instructions },
        ...turn.input,
      ]);
      assert.equal(body.max_tokens, 2048);
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { role: "assistant", content: "decision" },
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 10 },
      });
    });
    const runtime = createApiProvider(
      {
        ...config,
        provider,
        ...(provider === "openai-compatible"
          ? { baseUrl: "https://custom.example/v1/" }
          : {}),
      },
      { request, onUsage: usage },
    );
    assert.equal(await runtime.generate(turn), "decision");
    assert.deepEqual(usage.mock.calls[0].arguments[0], {
      provider,
      model: "test-model",
      inputTokens: 50,
      outputTokens: 10,
    });
    assert.equal(request.mock.callCount(), 1);
    runtime.close();
  });
}

test("string prompts normalize into user messages and usage callbacks cannot lose a successful decision", async () => {
  const runtime = createApiProvider(config, {
    request: async (_, init) => {
      assert.deepEqual(JSON.parse(init.body).input, [
        { role: "user", content: "view" },
      ]);
      return Response.json(complete());
    },
    onUsage() {
      throw new Error("database unavailable");
    },
  });
  assert.equal(
    await runtime.generate({ model: config.model, input: "view" }),
    "decision",
  );
});

for (const patch of [
  { provider: "subscription" },
  { model: "" },
  { apiKey: "" },
  { apiKey: "key\nheader" },
  { maxRequests: 0 },
  { maxOutputTokens: NaN },
  { timeoutMs: -1 },
  { maxConcurrentRequests: 13 },
  { baseUrl: "https://custom.example" },
  ...[
    "http://remote.example/v1",
    "https://key:secret@custom.example/v1",
    "https://custom.example/v1?key=secret",
    "https://custom.example/v1#secret",
    "file:///tmp/model",
  ].map((baseUrl) => ({ provider: "openai-compatible", baseUrl })),
])
  test(`rejects invalid trusted configuration ${JSON.stringify(patch)}`, () =>
    assert.throws(
      () => createApiProvider({ ...config, ...patch }),
      errorCode("configuration"),
    ));

for (const baseUrl of [
  "http://localhost:11434/v1",
  "http://127.0.0.1:1234/v1",
  "http://[::1]:1234/v1",
])
  test(`supports explicitly configured loopback endpoints ${baseUrl}`, () => {
    const runtime = createApiProvider({
      ...config,
      provider: "openai-compatible",
      baseUrl,
    });
    runtime.close();
  });

test("invalid input and model overrides never send a request", async () => {
  const request = mock.fn();
  const runtime = createApiProvider(config, { request });
  for (const patch of [
    { model: "different" },
    { input: [] },
    { input: [{ role: "system", content: "override" }] },
    { input: "" },
    { instructions: {} },
  ])
    await assert.rejects(
      runtime.generate({ ...turn, ...patch }),
      errorCode("configuration"),
    );
  await assert.rejects(
    runtime.generate({ ...turn, input: "x".repeat(128_001) }),
    errorCode("too-large"),
  );
  assert.equal(request.mock.callCount(), 0);
});

for (const [body, code] of [
  [complete("", { status: "incomplete" }), "incomplete"],
  [
    complete("", {
      output: [
        {
          type: "message",
          status: "completed",
          role: "assistant",
          content: [{ type: "refusal", refusal: "no" }],
        },
      ],
    }),
    "refused",
  ],
  [complete("", { output: [{ type: "function_call" }] }), "invalid-response"],
  [
    complete("", {
      output: [
        {
          type: "message",
          status: "in_progress",
          role: "assistant",
          content: [],
        },
      ],
    }),
    "incomplete",
  ],
  [complete(" "), "invalid-response"],
  [{ status: "completed", output: null }, "invalid-response"],
  [null, "incomplete"],
])
  test(`rejects incomplete/refused/malformed output: ${code}`, async () => {
    const runtime = createApiProvider(config, {
      request: async () => Response.json(body),
    });
    await assert.rejects(runtime.generate(turn), errorCode(code));
  });

for (const [provider, body] of [
  [
    "anthropic",
    {
      type: "message",
      role: "assistant",
      stop_reason: "max_tokens",
      content: [{ type: "text", text: "partial" }],
    },
  ],
  [
    "anthropic",
    {
      type: "message",
      role: "assistant",
      stop_reason: "end_turn",
      content: [{ type: "tool_use" }],
    },
  ],
  [
    "anthropic",
    {
      type: "message",
      role: "assistant",
      stop_reason: "end_turn",
      stop_details: { type: "refusal" },
      content: [{ type: "text", text: "no" }],
    },
  ],
  [
    "openai-compatible",
    {
      choices: [
        {
          finish_reason: "length",
          message: { role: "assistant", content: "partial" },
        },
      ],
    },
  ],
  [
    "openai-compatible",
    {
      choices: [
        {
          finish_reason: "stop",
          message: { role: "assistant", content: "text", tool_calls: [{}] },
        },
      ],
    },
  ],
  [
    "openai-compatible",
    {
      choices: [
        {
          finish_reason: "stop",
          message: { role: "assistant", content: "text", refusal: "no" },
        },
      ],
    },
  ],
])
  test(`${provider} does not accept truncated/tool/refusal output ${JSON.stringify(body)}`, async () => {
    const runtime = createApiProvider(
      {
        ...config,
        provider,
        ...(provider === "openai-compatible"
          ? { baseUrl: "https://custom.example/v1" }
          : {}),
      },
      { request: async () => Response.json(body) },
    );
    await assert.rejects(
      runtime.generate(turn),
      (error) => error instanceof ApiProviderError,
    );
  });

for (const [status, code] of [
  [401, "authentication"],
  [403, "authentication"],
  [429, "rate-limit"],
])
  test(`HTTP ${status} pauses paid requests until explicit retry without leaking provider data`, async () => {
    const request = mock.fn(
      async () => new Response("private-key my view", { status }),
    );
    const runtime = createApiProvider(config, { request });
    await assert.rejects(
      runtime.generate(turn),
      (error) =>
        errorCode(code)(error) &&
        !error.message.includes("private-key") &&
        !error.message.includes("my view") &&
        error.status === status,
    );
    await assert.rejects(runtime.generate(turn), errorCode("paused"));
    assert.equal(request.mock.callCount(), 1);
    runtime.retry();
    await assert.rejects(runtime.generate(turn), errorCode(code));
    assert.equal(request.mock.callCount(), 2);
  });

for (const status of [400, 500, 503])
  test(`HTTP ${status} is not automatically retried`, async () => {
    const request = mock.fn(
      async () => new Response("sensitive upstream error", { status }),
    );
    const runtime = createApiProvider(config, { request });
    await assert.rejects(
      runtime.generate(turn),
      errorCode(status >= 500 ? "unavailable" : "request"),
    );
    assert.equal(request.mock.callCount(), 1);
  });

test("network errors are sanitized", async () => {
  const runtime = createApiProvider(config, {
    request: async () => {
      throw new Error("private-key my view");
    },
  });
  await assert.rejects(
    runtime.generate(turn),
    (error) =>
      errorCode("unavailable")(error) && !error.message.includes("private-key"),
  );
});

test("attempt budget includes failures and retry does not replenish it", async () => {
  const request = mock.fn(async () => new Response("limited", { status: 429 }));
  const runtime = createApiProvider({ ...config, maxRequests: 1 }, { request });
  await assert.rejects(runtime.generate(turn), errorCode("rate-limit"));
  runtime.retry();
  await assert.rejects(runtime.generate(turn), errorCode("budget"));
  assert.equal(request.mock.callCount(), 1);
});

test("concurrency queues separate character requests without overspending the attempt budget", async () => {
  const gate = deferred();
  const request = mock.fn(async () => {
    await gate.promise;
    return Response.json(complete());
  });
  const runtime = createApiProvider(
    { ...config, maxConcurrentRequests: 1, maxRequests: 2 },
    { request },
  );
  const first = runtime.generate(turn),
    second = runtime.generate(turn),
    third = runtime.generate(turn);
  const results = Promise.allSettled([first, second, third]);
  await flush();
  assert.equal(request.mock.callCount(), 1);
  gate.resolve();
  const settled = await results;
  assert.deepEqual(
    settled.map((entry) => entry.status),
    ["fulfilled", "fulfilled", "rejected"],
  );
  assert.equal(settled[2].reason.code, "budget");
  assert.equal(request.mock.callCount(), 2);
});

test("close aborts active and queued requests and prevents future paid calls", async () => {
  const request = mock.fn(
    async (_, { signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("aborted")), {
          once: true,
        }),
      ),
  );
  const runtime = createApiProvider(
    { ...config, maxConcurrentRequests: 1 },
    { request },
  );
  const results = Promise.allSettled([
    runtime.generate(turn),
    runtime.generate(turn),
  ]);
  await flush();
  runtime.close();
  assert.deepEqual(
    (await results).map((entry) => entry.reason.code),
    ["cancelled", "cancelled"],
  );
  assert.equal(request.mock.callCount(), 1);
  await assert.rejects(runtime.generate(turn), errorCode("closed"));
});

test("caller cancellation includes queue time and does not consume an attempt", async () => {
  const controller = new AbortController();
  controller.abort();
  const request = mock.fn(async () => Response.json(complete()));
  const runtime = createApiProvider({ ...config, maxRequests: 1 }, { request });
  await assert.rejects(
    runtime.generate({ ...turn, signal: controller.signal }),
    errorCode("cancelled"),
  );
  assert.equal(await runtime.generate(turn), "decision");
  assert.equal(request.mock.callCount(), 1);
});

test("timeouts cancel response-body consumption as well as connection time", async () => {
  const runtime = createApiProvider(
    { ...config, timeoutMs: 10 },
    { request: async () => new Response(new ReadableStream({ start() {} })) },
  );
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(runtime.generate(turn), errorCode("timeout"));
  } finally {
    clearTimeout(keepAlive);
  }
});

test("response size and JSON parsing are bounded", async () => {
  for (const [text, code] of [
    ["not json", "invalid-response"],
    ["x".repeat(1_048_577), "too-large"],
  ]) {
    const runtime = createApiProvider(config, {
      request: async () => new Response(text),
    });
    await assert.rejects(runtime.generate(turn), errorCode(code));
  }
});

test("API generation drives real per-character decisions through the existing action validator", async () => {
  const requests = [];
  const runtime = createApiProvider(
    { ...config, maxConcurrentRequests: 1 },
    {
      request: async (_, init) => {
        const input = JSON.parse(init.body).input;
        const context = JSON.parse(input.at(-1).content).characters[0];
        requests.push(context);
        return Response.json(
          complete(
            JSON.stringify({
              characters: [
                {
                  playerName: context.snapshot.playerName,
                  actions: [
                    { kind: "chat", message: "Who do you suspect?" },
                    { kind: "visit", target: "Hidden Player" },
                  ],
                },
              ],
            }),
          ),
        );
      },
    },
  );
  const characters = ["Alice", "Bob"].map((playerName) => ({
    snapshot: {
      playerName,
      matchId: "match",
      time: "Day",
      canTalk: true,
      canVote: false,
      players: [
        { name: "Alice", isAlive: true },
        { name: "Bob", isAlive: true },
      ],
    },
    observations: [{ event: "private", data: `only ${playerName}` }],
    conversation: [],
    socket: { emit: mock.fn() },
  }));
  await runCharacterTurn({
    generate: runtime.generate,
    mode: "per-character",
    model: config.model,
    characters,
  });
  assert.equal(requests.length, 2);
  for (const [index, character] of characters.entries()) {
    assert.equal(
      requests[index].snapshot.playerName,
      character.snapshot.playerName,
    );
    assert.equal(
      JSON.stringify(requests[index]).includes(
        `only ${characters[1 - index].snapshot.playerName}`,
      ),
      false,
    );
    assert.deepEqual(
      character.socket.emit.mock.calls.map((call) => call.arguments),
      [["messageSentByUser", "Who do you suspect?", "Day"]],
    );
  }
});

test("usage is recorded for truncated paid output even though it cannot become an action", async () => {
  const usage = mock.fn();
  const runtime = createApiProvider(config, {
    request: async () =>
      Response.json(complete("partial", { status: "incomplete" })),
    onUsage: usage,
  });
  await assert.rejects(runtime.generate(turn), errorCode("incomplete"));
  assert.equal(usage.mock.calls[0].arguments[0].outputTokens, 10);
});

test("an asynchronous usage callback failure cannot reject a successful decision", async () => {
  const runtime = createApiProvider(config, {
    request: async () => Response.json(complete()),
    onUsage: async () => {
      throw new Error("accounting unavailable");
    },
  });
  assert.equal(await runtime.generate(turn), "decision");
  await flush();
});

test("queued request cancellation removes it without consuming budget or blocking the next seat", async () => {
  const gate = deferred();
  const request = mock.fn(async () => {
    await gate.promise;
    return Response.json(complete());
  });
  const runtime = createApiProvider(
    { ...config, maxConcurrentRequests: 1, maxRequests: 2 },
    { request },
  );
  const controller = new AbortController();
  const first = runtime.generate(turn);
  const cancelled = assert.rejects(
    runtime.generate({ ...turn, signal: controller.signal }),
    errorCode("cancelled"),
  );
  const last = runtime.generate(turn);
  await flush();
  controller.abort();
  await cancelled;
  gate.resolve();
  assert.deepEqual(await Promise.all([first, last]), ["decision", "decision"]);
  assert.equal(request.mock.callCount(), 2);
});

test("the waiting queue is bounded and close cancels every queued seat", async () => {
  const request = mock.fn(
    async (_, { signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("closed")), {
          once: true,
        }),
      ),
  );
  const runtime = createApiProvider(
    { ...config, maxConcurrentRequests: 1 },
    { request },
  );
  const results = Promise.allSettled(
    Array.from({ length: 26 }, () => runtime.generate(turn)),
  );
  await flush();
  assert.equal(request.mock.callCount(), 1);
  runtime.close();
  const settled = await results;
  assert.equal(
    settled.filter((entry) => entry.reason.code === "busy").length,
    1,
  );
  assert.equal(
    settled.filter((entry) => entry.reason.code === "cancelled").length,
    25,
  );
});
