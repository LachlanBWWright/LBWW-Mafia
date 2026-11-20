import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  createGenerationLimiter,
  withProviderLimits,
} from "../../../shared/ai/generationLimits.mjs";
import { ProviderError } from "../../../shared/ai/providerError.mjs";
import { abortable } from "../../../shared/ai/cancellation.mjs";

const input = { model: "test", input: "view" };
const flush = () => new Promise(setImmediate);
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const code = (expected) => (error) => error.code === expected;

test("one policy applies budgets, output caps, concurrency and queue cancellation to an arbitrary function", async () => {
  const gate = deferred();
  const generate = mock.fn(async (request) => {
    assert.equal(request.maxOutputTokens, 123);
    await gate.promise;
    return "decision";
  });
  const limiter = createGenerationLimiter(generate, {
    maxConcurrentRequests: 1,
    maxRequests: 2,
    maxOutputTokens: 123,
  });
  const controller = new AbortController();
  const first = limiter.generate({ ...input, maxOutputTokens: 1000 });
  const cancelled = assert.rejects(
    limiter.generate({ ...input, signal: controller.signal }),
    code("cancelled"),
  );
  const second = limiter.generate(input);
  const budget = assert.rejects(limiter.generate(input), code("budget"));
  await flush();
  assert.equal(generate.mock.callCount(), 1);
  controller.abort();
  await cancelled;
  gate.resolve();
  assert.deepEqual(await Promise.all([first, second]), [
    "decision",
    "decision",
  ]);
  await budget;
  limiter.retry();
  await assert.rejects(limiter.generate(input), code("budget"));
  assert.equal(generate.mock.callCount(), 2);
});

test("already-managed generation is reused and a deliberately tighter policy can be layered", async () => {
  const inner = createGenerationLimiter(async () => "decision", {
    maxRequests: 5,
  });
  assert.equal(createGenerationLimiter(inner.generate), inner);
  const tighter = createGenerationLimiter(inner.generate, { maxRequests: 1 });
  assert.equal(await tighter.generate(input), "decision");
  await assert.rejects(tighter.generate(input), code("budget"));
});

for (const limits of [
  { maxRequests: 0 },
  { maxConcurrentRequests: 13 },
  { maxQueuedRequests: -1 },
  { timeoutMs: NaN },
  { maxOutputTokens: 70_000 },
])
  test(`rejects invalid provider-neutral policy ${JSON.stringify(limits)}`, () =>
    assert.throws(
      () => createGenerationLimiter(async () => "", limits),
      code("configuration"),
    ));

test("invalid generators and invalid per-request caps do not invoke inference", async () => {
  assert.throws(() => createGenerationLimiter(null), code("configuration"));
  const generate = mock.fn(async () => "text");
  const limiter = createGenerationLimiter(generate);
  await assert.rejects(
    limiter.generate({ ...input, maxOutputTokens: 0 }),
    code("configuration"),
  );
  const signal = AbortSignal.abort();
  await assert.rejects(
    limiter.generate({ ...input, signal }),
    code("cancelled"),
  );
  assert.equal(generate.mock.callCount(), 0);
  assert.equal(
    await limiter.generate({ ...input, maxOutputTokens: 10 }),
    "text",
  );
  assert.equal(generate.mock.calls[0].arguments[0].maxOutputTokens, 10);
});

test("authentication and usage errors pause arbitrary providers until explicit retry", async () => {
  for (const failure of ["authentication", "rate-limit", "usage-limit"]) {
    let fail = true;
    const limiter = createGenerationLimiter(async () => {
      if (fail) throw Object.assign(new Error("blocked"), { code: failure });
      return "decision";
    });
    await assert.rejects(limiter.generate(input), code(failure));
    await assert.rejects(limiter.generate(input), code("paused"));
    fail = false;
    limiter.retry();
    assert.equal(await limiter.generate(input), "decision");
  }
});

test("timeouts and close cancel active/queued work promptly even when a provider ignores the signal", async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const timed = createGenerationLimiter(() => new Promise(() => {}), {
      timeoutMs: 10,
    });
    await assert.rejects(timed.generate(input), code("timeout"));
    timed.close();
    timed.close();
    timed.retry();
    await assert.rejects(timed.generate(input), code("closed"));
    const limiter = createGenerationLimiter(() => new Promise(() => {}), {
      maxConcurrentRequests: 1,
    });
    const result = Promise.allSettled([
      limiter.generate(input),
      limiter.generate(input),
    ]);
    await flush();
    limiter.close();
    assert.deepEqual(
      (await result).map((entry) => entry.reason.code),
      ["cancelled", "cancelled"],
    );
  } finally {
    clearTimeout(keepAlive);
  }
});

test("queue capacity is bounded and an aborted admission does not start inference", async () => {
  const gate = deferred();
  const generate = mock.fn(async () => {
    await gate.promise;
    return "decision";
  });
  const limiter = createGenerationLimiter(generate, {
    maxConcurrentRequests: 1,
    maxQueuedRequests: 1,
  });
  const result = Promise.allSettled([
    limiter.generate(input),
    limiter.generate(input),
    limiter.generate(input),
  ]);
  await flush();
  gate.resolve();
  assert.deepEqual(
    (await result).map((entry) =>
      entry.status === "fulfilled" ? entry.value : entry.reason.code,
    ),
    ["decision", "decision", "busy"],
  );
  const controller = new AbortController();
  const pending = limiter.generate({ ...input, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, code("cancelled"));
  assert.equal(generate.mock.callCount(), 2);
});

test("provider decorators preserve method binding, avoid accidental double limits, and clean up once", async () => {
  const close = mock.fn(),
    retry = mock.fn();
  const provider = {
    id: "sdk",
    model: "test",
    generate: mock.fn(function () {
      assert.equal(this.id, "sdk");
      return Promise.resolve("decision");
    }),
    close,
    retry,
  };
  const limited = withProviderLimits(provider, { maxRequests: 3 });
  assert.equal(withProviderLimits(limited), limited);
  assert.notEqual(withProviderLimits(limited, { maxRequests: 1 }), limited);
  assert.equal(await limited.generate(input), "decision");
  limited.retry();
  assert.equal(retry.mock.callCount(), 1);
  limited.close();
  limited.close();
  assert.equal(close.mock.callCount(), 1);
  limited.retry();
  assert.equal(retry.mock.callCount(), 1);
  const stateless = withProviderLimits({
    id: "local",
    model: "test",
    generate: async () => "decision",
  });
  stateless.retry();
  stateless.close();
});

test("abortable observes late failures and supports no-signal operations", async () => {
  assert.equal(await abortable(async () => "text"), "text");
  assert.throws(
    () => abortable(async () => "text", AbortSignal.abort()),
    (error) => error.name === "AbortError",
  );
  const controller = new AbortController();
  const gate = deferred();
  const pending = abortable(async () => {
    await gate.promise;
    throw new ProviderError("unavailable", "late failure");
  }, controller.signal);
  await flush();
  controller.abort();
  await assert.rejects(pending, (error) => error.name === "AbortError");
  gate.resolve();
  await flush();
});

test("class-based providers retain prototype metadata and private method state", async () => {
  class SdkProvider {
    #calls = 0;
    get id() {
      return "class-sdk";
    }
    get model() {
      return "deployment";
    }
    async generate() {
      this.#calls++;
      return String(this.#calls);
    }
  }
  const limited = withProviderLimits(new SdkProvider());
  assert.equal(limited.id, "class-sdk");
  assert.equal(limited.model, "deployment");
  assert.equal(
    await limited.generate({ model: "deployment", input: "view" }),
    "1",
  );
  limited.close();
});
