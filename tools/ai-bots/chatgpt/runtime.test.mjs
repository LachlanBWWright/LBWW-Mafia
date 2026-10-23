import { generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createChatGPTRuntime } from "./runtime.mjs";
import { createStore } from "./store.mjs";
import { completedText } from "./inference.mjs";

const initial = {
  clientId: "oaiapp_test",
  subject: "subject",
  email: "test@example.invalid",
  accessToken: "private-access",
  refreshToken: "private-refresh",
  idToken: "private-id",
  expiresAt: 1,
  scopes: ["resource.invoke", "chatgpt.tokens.use.direct"],
};
const frame = (event) => `data: ${JSON.stringify(event)}\n\n`;
const completed = (text) => ({
  type: "response.completed",
  response: {
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
  },
});
async function fixture(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "mafia-chatgpt-"));
  const store = createStore(directory);
  await store.save(initial);
  const runtime = createChatGPTRuntime({ directory, ...options });
  t.after(async () => {
    runtime.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { runtime, store, directory };
}

test("cancelling while a platform listener is starting closes the late transaction", async (t) => {
  let release;
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  let closed = false;
  const { runtime } = await fixture(t, {
    authorizeClient: async () => {
      started();
      await waiting;
      return {
        cancel: () => {
          closed = true;
        },
      };
    },
  });
  const opening = runtime.startSignIn();
  await ready;
  runtime.cancelSignIn();
  release();
  await assert.rejects(opening, { code: "changed" });
  assert.equal(closed, true);
  assert.equal((await runtime.connection()).signingIn, false);
});

test("rotating refresh is serialized across simultaneous model requests and credentials stay private", async (t) => {
  let refreshes = 0;
  const { runtime, store, directory } = await fixture(t, {
    request: async (url, init) => {
      if (url.endsWith("/oauth/token")) {
        refreshes++;
        await new Promise((r) => setTimeout(r, 20));
        return Response.json({
          access_token: "rotated",
          refresh_token: "rotated-refresh",
          token_type: "Bearer",
          expires_in: 3600,
        });
      }
      assert.equal(init.headers.authorization, "Bearer rotated");
      return Response.json({
        models: [
          { slug: "available", display_name: "Available", visibility: "list" },
          { slug: "hidden", visibility: "hide" },
        ],
      });
    },
  });
  const results = await Promise.all([
    runtime.models(),
    runtime.models(),
    runtime.models(),
  ]);
  assert.equal(refreshes, 1);
  assert.equal(results[0].length, 1);
  assert.equal((await store.load()).refreshToken, "rotated-refresh");
  const status = JSON.stringify(await runtime.connection());
  for (const secret of ["rotated", "private-id", "oaiapp_test"])
    assert.equal(status.includes(secret), false);
  assert.equal((await stat(directory)).mode & 0o777, 0o700);
  assert.equal((await stat(store.path)).mode & 0o777, 0o600);
});

test("terminal refresh failures clear unusable credentials but keep issued registration", async (t) => {
  const { runtime, store } = await fixture(t, {
    request: async () =>
      Response.json({ error: "invalid_grant" }, { status: 400 }),
  });
  await assert.rejects(runtime.models(), { code: "reconnect" });
  assert.equal((await store.load()).clientId, "oaiapp_test");
  assert.equal((await store.load()).accessToken, undefined);
});

test("temporary refresh failures preserve the account for retry", async (t) => {
  const { runtime, store } = await fixture(t, {
    request: async () => new Response(null, { status: 503 }),
  });
  await assert.rejects(runtime.models());
  assert.equal((await store.load()).refreshToken, "private-refresh");
});

test("disconnect clears locally before remote revocation and rejects stale refresh writes", async (t) => {
  let release;
  let started;
  const ready = new Promise((r) => {
    started = r;
  });
  const { runtime, store } = await fixture(t, {
    request: async (url) => {
      if (url.endsWith("/oauth/token")) {
        started();
        await new Promise((r) => {
          release = r;
        });
        return Response.json({
          access_token: "stale",
          token_type: "Bearer",
          expires_in: 3600,
        });
      }
      assert.equal((await store.load()).accessToken, undefined);
      throw new Error("offline");
    },
  });
  const refresh = runtime.models();
  await ready;
  const signingOut = runtime.signOut();
  release();
  await assert.rejects(refresh, { code: "changed" });
  assert.equal((await signingOut).remoteRevocationConfirmed, false);
  assert.equal((await store.load()).accessToken, undefined);
});

test("plan usage limits pause inference until explicit retry, with no billing fallback", async (t) => {
  let requests = 0;
  const { runtime, store } = await fixture(t, {
    request: async () => {
      requests++;
      return Response.json(
        { error: { code: "subscription_sharing_usage_limit_exceeded" } },
        { status: 429 },
      );
    },
  });
  await store.save({ ...initial, expiresAt: Date.now() + 3600_000 });
  await assert.rejects(runtime.generate({ model: "available", input: "hi" }), {
    code: "usage-limit",
  });
  await assert.rejects(runtime.generate({ model: "available", input: "hi" }), {
    code: "usage-limit",
  });
  assert.equal(requests, 1);
  runtime.retryUsage();
  await assert.rejects(runtime.generate({ model: "available", input: "hi" }));
  assert.equal(requests, 2);
});

test("inference sends the selected model, uses OAuth and only commits completed response text", async (t) => {
  const { runtime, store } = await fixture(t, {
    request: async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      assert.equal(init.headers.authorization, "Bearer private-access");
      assert.deepEqual(JSON.parse(init.body), {
        model: "available",
        instructions: "play",
        input: [{ role: "user", content: "hi" }],
        store: false,
        stream: true,
      });
      return new Response(
        frame({
          type: "response.output_text.delta",
          delta: "untrusted delta",
        }) + frame(completed("authoritative")),
      );
    },
  });
  await store.save({ ...initial, expiresAt: Date.now() + 3600_000 });
  assert.equal(
    await runtime.generate({
      model: "available",
      instructions: "play",
      input: "hi",
    }),
    "authoritative",
  );
});

test("interrupted, incomplete and refused streams never become AI decisions", async () => {
  for (const event of [
    { type: "response.output_text.delta", delta: "partial" },
    { type: "response.incomplete" },
    { type: "response.failed" },
    {
      type: "response.completed",
      response: {
        output: [{ type: "message", content: [{ type: "refusal" }] }],
      },
    },
  ])
    await assert.rejects(completedText(new Response(frame(event))));
  const item = {
    type: "message",
    content: [{ type: "output_text", text: "complete item" }],
  };
  assert.equal(
    await completedText(
      new Response(
        frame({ type: "response.output_item.done", output_index: 0, item }) +
          frame({ type: "response.completed", response: { output: [] } }),
      ),
    ),
    "complete item",
  );
});

test("saved registrations are reused even after failed authorization exchange", async (t) => {
  let registration;
  const { runtime, store } = await fixture(t, {
    authorizeClient: async (input) => {
      registration = input.registration;
      return {
        authorizationUrl: "https://auth.openai.com/api/accounts/authorize",
        nonce: "nonce",
        verifier: "verifier",
        redirectUri: "http://127.0.0.1:1234/auth/callback",
        result: Promise.resolve({ code: "code", clientId: "oaiapp_test" }),
        cancel() {},
      };
    },
    request: async () => new Response(null, { status: 503 }),
  });
  await runtime.startSignIn();
  for (let i = 0; i < 20 && (await runtime.connection()).signingIn; i++)
    await new Promise((r) => setTimeout(r, 5));
  assert.equal(registration.clientId, "oaiapp_test");
  assert.equal((await store.load()).accessToken, "private-access");
  assert.equal((await runtime.connection()).error.code, "unavailable");
});

test("successful OAuth verifies and persists plan credentials without returning them to the UI", async (t) => {
  let grantedScopes = "openid profile email";
  const consentRequests = [];
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "test",
    alg: "RS256",
  };
  const payload = {
    iss: "https://auth.openai.com",
    aud: "oaiapp_test",
    sub: "subject",
    nonce: "fresh-nonce",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    email: "connected@example.invalid",
  };
  const unsigned = [
    Buffer.from(JSON.stringify({ alg: "RS256", kid: "test" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
  ].join(".");
  const idToken = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url")}`;
  const { runtime, store } = await fixture(t, {
    authorizeClient: async (input) => {
      consentRequests.push(input);
      return {
        authorizationUrl: "https://auth.openai.com/api/accounts/authorize",
        nonce: "fresh-nonce",
        verifier: "bound-verifier",
        redirectUri: "http://127.0.0.1:1234/auth/callback",
        result: Promise.resolve({
          code: "one-time-code",
          clientId: "oaiapp_test",
        }),
        cancel() {},
      };
    },
    request: async (url, init) => {
      if (url.endsWith("jwks.json")) return Response.json({ keys: [jwk] });
      assert.equal(init.body.get("code_verifier"), "bound-verifier");
      assert.equal(init.body.get("client_id"), "oaiapp_test");
      assert.equal(init.body.has("client_secret"), false);
      return Response.json({
        access_token: "new-private-access",
        refresh_token: "new-private-refresh",
        id_token: idToken,
        token_type: "Bearer",
        expires_in: 3600,
        scope: grantedScopes,
      });
    },
  });
  await runtime.startSignIn();
  for (let i = 0; i < 100 && (await runtime.connection()).signingIn; i++)
    await new Promise((r) => setTimeout(r, 5));
  assert.equal((await runtime.connection()).connected, true);
  assert.equal((await runtime.connection()).planEnabled, false);
  await assert.rejects(runtime.models(), { code: "permission" });
  await assert.rejects(runtime.generate({ model: "available", input: "hi" }), {
    code: "permission",
  });
  grantedScopes = "resource.invoke chatgpt.tokens.use.direct";
  await runtime.startSignIn();
  for (let i = 0; i < 100 && (await runtime.connection()).signingIn; i++)
    await new Promise((r) => setTimeout(r, 5));
  assert.equal(consentRequests[0].reconsent, false);
  assert.equal(consentRequests[1].reconsent, true);
  assert.equal(consentRequests[1].registration.clientId, "oaiapp_test");
  const status = await runtime.connection();
  assert.equal(status.connected, true);
  assert.equal(status.planEnabled, true);
  assert.equal(status.email, "connected@example.invalid");
  assert.equal(status.error, null);
  assert.equal((await store.load()).refreshToken, "new-private-refresh");
  assert.equal(JSON.stringify(status).includes("new-private"), false);
});

test("usage-limit failures during streaming pause later requests and preserve diagnostics", async (t) => {
  let requests = 0;
  const { runtime, store } = await fixture(t, {
    request: async () => {
      requests++;
      return new Response(
        frame({ type: "response.output_text.delta", delta: "partial" }) +
          frame({
            type: "response.failed",
            response: {
              error: {
                code: "subscription_sharing_usage_limit_exceeded",
                param: "model",
              },
            },
          }),
        { headers: { "x-request-id": "request-stream" } },
      );
    },
  });
  await store.save({ ...initial, expiresAt: Date.now() + 3600_000 });
  await assert.rejects(runtime.generate({ model: "available", input: "hi" }), {
    code: "usage-limit",
    providerCode: "subscription_sharing_usage_limit_exceeded",
    requestId: "request-stream",
    status: 200,
    param: "model",
  });
  assert.equal((await runtime.connection()).usagePaused, true);
  await assert.rejects(runtime.generate({ model: "available", input: "hi" }), {
    code: "usage-limit",
  });
  assert.equal(requests, 1);
  runtime.retryUsage();
  await assert.rejects(runtime.generate({ model: "available", input: "hi" }));
  assert.equal(requests, 2);
});

test("model catalogs arriving after disconnect cannot restore a stale account view", async (t) => {
  let release;
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const response = Response.json({});
  response.json = () => {
    started();
    return new Promise((resolve) => {
      release = resolve;
    });
  };
  const { runtime, store } = await fixture(t, {
    request: async () => response,
  });
  await store.save({
    ...initial,
    refreshToken: null,
    expiresAt: Date.now() + 3600_000,
  });
  const models = runtime.models();
  await ready;
  await runtime.signOut();
  release({ models: [{ slug: "available", visibility: "list" }] });
  await assert.rejects(models, { code: "changed" });
});

test("successful revocation uses the discovered trusted endpoint after clearing local tokens", async (t) => {
  let requests = 0;
  const { runtime, store } = await fixture(t, {
    request: async (url, init) => {
      requests++;
      assert.equal((await store.load()).accessToken, undefined);
      if (String(url).endsWith("openid-configuration"))
        return Response.json({
          issuer: "https://auth.openai.com",
          revocation_endpoint: "https://auth.openai.com/oauth/revoke",
        });
      assert.equal(String(url), "https://auth.openai.com/oauth/revoke");
      assert.equal(init.method, "POST");
      assert.equal(init.redirect, "error");
      assert.equal(init.body.get("token"), "private-refresh");
      assert.equal(init.body.get("client_id"), "oaiapp_test");
      assert.equal(init.body.get("token_type_hint"), "refresh_token");
      return new Response(null, { status: 200 });
    },
  });
  assert.deepEqual(await runtime.signOut(), {
    remoteRevocationConfirmed: true,
  });
  assert.equal(requests, 2);
  assert.equal((await store.load()).idToken, undefined);
  assert.equal((await runtime.connection()).connected, false);
});

for (const metadata of [
  {
    issuer: "https://attacker.example",
    revocation_endpoint: "https://auth.openai.com/revoke",
  },
  {
    issuer: "https://auth.openai.com",
    revocation_endpoint: "https://attacker.example/revoke",
  },
  {
    issuer: "https://auth.openai.com",
    revocation_endpoint: "https://user:pass@auth.openai.com/revoke",
  },
  {
    issuer: "https://auth.openai.com",
    revocation_endpoint: "https://auth.openai.com/revoke#fragment",
  },
  {},
])
  test(`revocation refuses untrusted discovery: ${JSON.stringify(metadata)}`, async (t) => {
    let requests = 0;
    const { runtime, store } = await fixture(t, {
      request: async () => {
        requests++;
        return Response.json(metadata);
      },
    });
    assert.deepEqual(await runtime.signOut(), {
      remoteRevocationConfirmed: false,
    });
    assert.equal(requests, 1);
    assert.equal((await store.load()).refreshToken, undefined);
  });

test("no renewable session is reported accurately without making revocation requests", async (t) => {
  const { runtime, store } = await fixture(t, {
    request: async () => {
      throw new Error("must not request");
    },
  });
  await store.save({ clientId: initial.clientId });
  assert.equal((await runtime.signOut()).remoteRevocationConfirmed, true);
  await store.save({ ...initial, refreshToken: null });
  assert.equal((await runtime.signOut()).remoteRevocationConfirmed, false);
});

test("expired nonrenewable grants and absent credentials never invoke inference", async (t) => {
  const { runtime, store } = await fixture(t, {
    request: async () => {
      throw new Error("must not request");
    },
  });
  await store.save({ ...initial, refreshToken: null });
  await assert.rejects(runtime.models(), { code: "reconnect" });
  await store.save({ clientId: initial.clientId });
  await assert.rejects(runtime.generate({ model: "model", input: "hi" }), {
    code: "reconnect",
  });
});

test("refresh permission reductions are persisted and block later inference", async (t) => {
  let calls = 0;
  const { runtime, store } = await fixture(t, {
    request: async () => {
      calls++;
      return Response.json({
        access_token: "restricted",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid",
      });
    },
  });
  await assert.rejects(runtime.models(), { code: "permission" });
  assert.equal((await runtime.connection()).connected, true);
  assert.equal((await runtime.connection()).planEnabled, false);
  assert.equal((await store.load()).accessToken, "restricted");
  await assert.rejects(runtime.generate({ model: "model", input: "hi" }), {
    code: "permission",
  });
  assert.equal(calls, 1);
});

test("catalog validation rejects malformed responses and omits empty or hidden model slugs", async (t) => {
  let value = {};
  const { runtime, store } = await fixture(t, {
    request: async () => Response.json(value),
  });
  await store.save({ ...initial, expiresAt: Date.now() + 3600_000 });
  await assert.rejects(runtime.models(), { code: "invalid-models" });
  value = {
    models: [
      null,
      { slug: "", visibility: "list" },
      { slug: "hidden", visibility: "hide" },
      { slug: "m".repeat(201), visibility: "list" },
      { slug: "first", visibility: "list" },
      { slug: "second", display_name: "Second", visibility: "list" },
    ],
  };
  assert.deepEqual(await runtime.models(), [
    { slug: "first", name: "first" },
    { slug: "second", name: "Second" },
  ]);
});

for (const verified of [false, "different-subject"])
  test(`failed identity validation preserves an existing grant (${verified})`, async (t) => {
    const { runtime, store } = await fixture(t, {
      authorizeClient: async () => ({
        authorizationUrl: "https://auth.openai.com/api/accounts/authorize",
        nonce: "nonce",
        verifier: "verifier",
        redirectUri: "http://127.0.0.1:1234/auth/callback",
        result: Promise.resolve({ code: "code", clientId: initial.clientId }),
        cancel() {},
      }),
      verifyIdentity: async () => {
        if (!verified)
          throw new Error("untrusted diagnostic with private info");
        return { sub: verified };
      },
      request: async () =>
        Response.json({
          access_token: "new-access",
          token_type: "Bearer",
          expires_in: 3600,
          id_token: "unverified",
          scope: "resource.invoke chatgpt.tokens.use.direct",
        }),
    });
    await runtime.startSignIn();
    for (let i = 0; i < 100 && (await runtime.connection()).signingIn; i++)
      await new Promise((resolve) => setTimeout(resolve, 1));
    assert.equal((await store.load()).accessToken, initial.accessToken);
    const account = await runtime.connection();
    assert.ok(account.error);
    assert.equal(JSON.stringify(account).includes("private info"), false);
  });

test("a first registration survives failed exchange and is reused on retry", async (t) => {
  const registrations = [];
  const { runtime, store } = await fixture(t, {
    authorizeClient: async ({ registration }) => {
      registrations.push(registration);
      return {
        authorizationUrl: "https://auth.openai.com/api/accounts/authorize",
        nonce: "nonce",
        verifier: "verifier",
        redirectUri: "http://127.0.0.1:1234/auth/callback",
        result: Promise.resolve({ code: "code", clientId: "oaiapp_new" }),
        cancel() {},
      };
    },
    request: async () => new Response(null, { status: 503 }),
  });
  await rm(store.path);
  for (let attempt = 0; attempt < 2; attempt++) {
    await runtime.startSignIn();
    for (let i = 0; i < 100 && (await runtime.connection()).signingIn; i++)
      await new Promise((resolve) => setTimeout(resolve, 1));
  }
  assert.equal(registrations[0], null);
  assert.equal(registrations[1].clientId, "oaiapp_new");
  assert.equal((await store.load()).accessToken, undefined);
});

test("duplicate authorization is rejected and explicit cancellation stops its listener", async (t) => {
  let finish;
  let cancellations = 0;
  const result = new Promise((resolve) => {
    finish = resolve;
  });
  const { runtime } = await fixture(t, {
    authorizeClient: async () => ({
      authorizationUrl: "https://auth.openai.com/api/accounts/authorize",
      result,
      cancel() {
        cancellations++;
        finish({
          error: Object.assign(new Error("cancelled"), { code: "cancelled" }),
        });
      },
    }),
  });
  await runtime.startSignIn();
  await assert.rejects(runtime.startSignIn(), { code: "busy" });
  runtime.cancelSignIn();
  assert.equal((await runtime.connection()).signingIn, false);
  assert.equal(cancellations, 1);
});
