import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { authorize } from "./oauth.mjs";
import { verifyIdentity, parseTokens, providerFailure } from "./protocol.mjs";
import { createAccess } from "./access.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test", alg: "RS256" };
const now = Date.now();
const claims = { iss: "https://auth.openai.com", aud: "oaiapp_test", sub: "user-1", nonce: "nonce", exp: Math.floor(now / 1000) + 300, iat: Math.floor(now / 1000) };
const token = (value) => {
  const data = [Buffer.from(JSON.stringify({ alg: "RS256", kid: "test" })).toString("base64url"), Buffer.from(JSON.stringify(value)).toString("base64url")].join(".");
  return `${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`;
};
const request = async () => Response.json({ keys: [jwk] });

test("admission and configuration failures preserve diagnostics without suggesting consent for every 403", async () => {
  const body = { detail: "Serving region denied" };
  const error = await providerFailure(Response.json(body, { status: 403, headers: { "x-request-id": "request-admission" } }));
  assert.equal(error.code, "restricted");
  assert.equal(error.status, 403);
  assert.equal(error.requestId, "request-admission");
  assert.deepEqual(error.body, body);
  for (const code of ["invalid_client", "subscription_sharing_unsupported_capability", "subscription_sharing_route_not_supported"])
    assert.equal((await providerFailure(Response.json({ error: { code, param: "model" } }, { status: 400 }))).code, "configuration");
});

test("first authorization uses PKCE and only consumes the matching callback once", async () => {
  const flow = await authorize({ hostId: "urn:uuid:installation", timeoutMs: 1000 });
  try {
    const url = new URL(flow.authorizationUrl);
    assert.equal(url.searchParams.get("client_id"), "dynamic_agent_client");
    assert.equal(url.searchParams.get("agent_name_hint"), "LBWW Mafia");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("resource"), "https://api.openai.com/v1");
    assert.match(url.searchParams.get("scope"), /chatgpt.tokens.use.direct/);
    const callback = new URL(flow.redirectUri);
    callback.search = new URLSearchParams({ state: "wrong", code: "code", client_id: "oaiapp_test" });
    assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.set("state", url.searchParams.get("state"));
    callback.searchParams.append("code", "duplicate");
    assert.equal((await fetch(callback)).status, 400);
    callback.searchParams.delete("code"); callback.searchParams.set("code", "code");
    assert.equal((await fetch(callback)).status, 200);
    assert.deepEqual(await flow.result, { code: "code", clientId: "oaiapp_test" });
  } finally { flow.cancel(); }
});

test("reauthorization reuses registration and rejects a changed returned client", async () => {
  const flow = await authorize({ hostId: "host", registration: { clientId: "oaiapp_saved", email: "saved@example.invalid", idToken: "hint" }, timeoutMs: 1000 });
  try {
    const url = new URL(flow.authorizationUrl);
    assert.equal(url.searchParams.get("client_id"), "oaiapp_saved");
    assert.equal(url.searchParams.get("id_token_hint"), "hint");
    assert.equal(url.searchParams.has("prompt"), false);
    const callback = new URL(flow.redirectUri);
    callback.search = new URLSearchParams({ state: url.searchParams.get("state"), code: "code", client_id: "oaiapp_other" });
    assert.equal((await fetch(callback)).status, 400);
    assert.equal((await flow.result).error.code, "cancelled");
  } finally { flow.cancel(); }
});

test("cancellation and timeout close the callback listener", async () => {
  const flow = await authorize({ hostId: "host", timeoutMs: 10 });
  assert.equal((await flow.result).error.code, "expired");
  const cancelled = await authorize({ hostId: "host" }); cancelled.cancel();
  assert.equal((await cancelled.result).error.code, "cancelled");
});

test("validates signed identity, issuer, audience, authorized party, dates and nonce", async () => {
  assert.equal((await verifyIdentity(token(claims), "oaiapp_test", "nonce", request, now)).sub, "user-1");
  for (const patch of [{ iss: "https://attacker.invalid" }, { aud: "other" }, { aud: ["oaiapp_test", "other"] }, { azp: "other" }, { exp: undefined }, { exp: 1 }, { iat: undefined }, { iat: 9e12 }, { nonce: "wrong" }, { sub: "" }]) {
    await assert.rejects(verifyIdentity(token({ ...claims, ...patch }), "oaiapp_test", "nonce", request, now));
  }
  const tampered = `${token(claims).slice(0, -12)}AAAAAAAAAAAA`;
  await assert.rejects(verifyIdentity(tampered, "oaiapp_test", "nonce", request, now));
});

test("parses identity-only grants separately from plan permission, never an API key", () => {
  const valid = { access_token: "oauth-access", refresh_token: "renewable", token_type: "Bearer", expires_in: 3600, scope: "resource.invoke chatgpt.tokens.use.direct" };
  assert.equal(parseTokens(valid).accessToken, "oauth-access");
  assert.deepEqual(parseTokens({ ...valid, scope: "openid profile" }).scopes, ["openid", "profile"]);
  for (const patch of [{ access_token: "" }, { token_type: "api-key" }, { expires_in: NaN }])
    assert.throws(() => parseTokens({ ...valid, ...patch }));
  const refreshed = parseTokens({ ...valid, refresh_token: undefined, scope: undefined }, parseTokens(valid));
  assert.equal(refreshed.refreshToken, "renewable");
});

test("explicit enablement requests consent with the saved client", async () => {
  const flow = await authorize({ hostId: "host", registration: { clientId: "oaiapp_saved" }, reconsent: true });
  try {
    const url = new URL(flow.authorizationUrl);
    assert.equal(url.searchParams.get("prompt"), "consent");
    assert.equal(url.searchParams.get("client_id"), "oaiapp_saved");
    assert.match(url.searchParams.get("scope"), /chatgpt.tokens.use.direct/);
  } finally { flow.cancel(); }
});

test("LAN access needs explicit local approval and a one-time proof, bound to origin and device", () => {
  let now = 100;
  const access = createAccess({ now: () => now });
  const verifier = "v".repeat(64);
  // Known S256 digest, computed in the client in production.
  return import("node:crypto").then(({ createHash }) => {
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const start = access.start(challenge, "http://localhost:3000", "192.168.1.8");
    assert.equal(start.needsApproval, true);
    assert.deepEqual(access.finish(start.id, verifier, "http://localhost:3000", "192.168.1.8"), { pending: true });
    assert.equal(access.approve(start.id, "wrong"), false);
    const html = access.approval(start.id);
    const csrf = html.match(/name="csrf" value="([^"]+)"/)[1];
    assert.equal(access.approve(start.id, csrf), true);
    assert.equal(access.finish(start.id, "wrong", "http://localhost:3000", "192.168.1.8"), null);
    const { token } = access.finish(start.id, verifier, "http://localhost:3000", "192.168.1.8");
    assert.equal(access.finish(start.id, verifier, "http://localhost:3000", "192.168.1.8"), null);
    assert.equal(access.verify(token, "https://evil.invalid", "192.168.1.8"), false);
    assert.equal(access.verify(token, "http://localhost:3000", "192.168.1.8"), true);
    now += 9 * 60 * 60_000;
    assert.equal(access.verify(token, "http://localhost:3000", "192.168.1.8"), false);
  });
});
