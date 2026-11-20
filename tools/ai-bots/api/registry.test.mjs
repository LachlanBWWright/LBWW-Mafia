import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  builtinApiAdapters,
  createApiProvider,
  createProviderRegistry,
  defaultApiProviderRegistry,
} from "../../../shared/ai/provider.mjs";
import { ProviderError } from "../../../shared/ai/providerError.mjs";
import { apiConfigFromEnvironment } from "./runtime.mjs";

// Deliberately unrelated to OpenAI/Anthropic: different auth, body, completion and usage fields.
const acme = {
  id: "acme",
  apiKeyEnv: "ACME_TOKEN",
  create(config) {
    return {
      url: "https://acme.example/generate",
      headers: { "X-Acme-Token": config.apiKey },
      encode({ model, instructions, messages, maxOutputTokens }) {
        return {
          deployment: model,
          policy: instructions,
          conversation: messages,
          output_limit: maxOutputTokens,
        };
      },
      decode(body) {
        if (body?.finished !== true || typeof body.answer !== "string")
          throw new ProviderError("incomplete", "Acme did not complete.");
        return body.answer;
      },
      usage: (body) => ({
        inputTokens: body?.metrics?.read,
        outputTokens: body?.metrics?.written,
      }),
    };
  },
};

test("adding a new HTTP provider needs only an adapter and host registration", async () => {
  const registry = createProviderRegistry([...builtinApiAdapters, acme]);
  const config = apiConfigFromEnvironment(
    {
      MAFIA_AI_PROVIDER: "acme",
      MAFIA_AI_MODEL: "deployment-a",
      ACME_TOKEN: "acme-secret",
      MAFIA_AI_MAX_REQUESTS: "1",
    },
    { registry },
  );
  const usage = mock.fn();
  const request = mock.fn(async (url, init) => {
    assert.equal(url, "https://acme.example/generate");
    assert.equal(init.headers["X-Acme-Token"], "acme-secret");
    assert.equal(init.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(init.body), {
      deployment: "deployment-a",
      policy: "Play Mafia.",
      conversation: [{ role: "user", content: "view" }],
      output_limit: 2048,
    });
    return Response.json({
      finished: true,
      answer: "decision",
      metrics: { read: 20, written: 8 },
    });
  });
  const provider = createApiProvider(config, {
    registry,
    request,
    onUsage: usage,
  });
  assert.equal(provider.id, "acme");
  const input = {
    model: "deployment-a",
    instructions: "Play Mafia.",
    input: "view",
  };
  assert.equal(await provider.generate(input), "decision");
  await assert.rejects(
    provider.generate(input),
    (error) => error.code === "budget",
  );
  assert.equal(request.mock.callCount(), 1);
  assert.deepEqual(usage.mock.calls[0].arguments[0], {
    provider: "acme",
    model: "deployment-a",
    inputTokens: 20,
    outputTokens: 8,
  });
  provider.close();
});

test("HTTP adapters do not have to use API keys or vendor-specific usage", async () => {
  const adapter = {
    id: "local-model",
    create: () => ({
      url: "http://127.0.0.1:9000/infer",
      encode: ({ messages }) => ({ turns: messages }),
      decode: (body) => body.reply,
    }),
  };
  const registry = createProviderRegistry([adapter]);
  const config = apiConfigFromEnvironment(
    { MAFIA_AI_PROVIDER: "local-model", MAFIA_AI_MODEL: "local" },
    { registry },
  );
  const usage = mock.fn();
  const provider = createApiProvider(config, {
    registry,
    onUsage: usage,
    request: async (_, init) => {
      assert.equal(init.headers.Authorization, undefined);
      assert.equal(JSON.stringify(init.headers).includes("undefined"), false);
      return Response.json({ reply: "local decision" });
    },
  });
  assert.equal(
    await provider.generate({ model: "local", input: "view" }),
    "local decision",
  );
  assert.deepEqual(usage.mock.calls[0].arguments[0], {
    provider: "local-model",
    model: "local",
    inputTokens: null,
    outputTokens: null,
  });
});

test("registration is isolated and rejects duplicate IDs, invalid adapters and unknown providers", () => {
  const registry = createProviderRegistry([acme]);
  assert.deepEqual(registry.ids(), ["acme"]);
  registry.ids().push("unregistered");
  assert.deepEqual(registry.ids(), ["acme"]);
  assert.deepEqual(defaultApiProviderRegistry.ids(), [
    "openai",
    "anthropic",
    "openai-compatible",
  ]);
  assert.throws(() => defaultApiProviderRegistry.get("acme"), /registered/);
  assert.throws(() => createProviderRegistry([acme, acme]), /unique/);
  assert.throws(
    () => createProviderRegistry([{ id: "broken" }]),
    /create function/,
  );
  assert.throws(() => registry.get("__proto__"), /registered/);
});

test("custom HTTP adapters still inherit endpoint validation and output checks", async () => {
  const config = { provider: "custom", model: "model" };
  const invalid = {
    id: "custom",
    create: () => ({
      url: "http://remote.example/infer",
      encode: () => ({}),
      decode: () => "text",
    }),
  };
  assert.throws(
    () =>
      createApiProvider(config, {
        registry: createProviderRegistry([invalid]),
      }),
    /HTTPS/,
  );
  const empty = {
    ...invalid,
    create: () => ({
      url: "https://custom.example/infer",
      encode: () => ({}),
      decode: () => "",
    }),
  };
  const provider = createApiProvider(config, {
    registry: createProviderRegistry([empty]),
    request: async () => Response.json({}),
  });
  await assert.rejects(
    provider.generate({ model: "model", input: "view" }),
    (error) => error.code === "invalid-response",
  );
});

test("adapter usage parsing failures cannot lose a completed decision", async () => {
  const adapter = {
    ...acme,
    create(config) {
      return {
        ...acme.create(config),
        usage() {
          throw new Error("unsupported metrics");
        },
      };
    },
  };
  const provider = createApiProvider(
    { provider: "acme", model: "model" },
    {
      registry: createProviderRegistry([adapter]),
      request: async () =>
        Response.json({ finished: true, answer: "decision" }),
    },
  );
  assert.equal(
    await provider.generate({ model: "model", input: "view" }),
    "decision",
  );
});
