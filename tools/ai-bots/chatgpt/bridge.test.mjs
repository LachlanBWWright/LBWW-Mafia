import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createHash } from "node:crypto";

async function unusedPort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve)); return port;
}

test("companion starts disconnected, rejects hostile origins and requires device sessions without pasted keys", async (t) => {
  const port = await unusedPort();
  const directory = await mkdtemp(join(tmpdir(), "mafia-bridge-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const child = spawn(globalThis.process.execPath, [new URL("../cli.mjs", import.meta.url).pathname, "--", "serve"], {
    env: { ...globalThis.process.env, MAFIA_AI_BOT_PORT: String(port), MAFIA_CHATGPT_DATA_DIR: directory, MAFIA_AI_ALLOWED_ORIGINS: "http://localhost:3000" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    const done = new Promise((resolve) => child.once("exit", resolve));
    child.kill("SIGTERM"); await done;
  });
  let output = "";
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Companion did not start")), 10_000);
    child.stdout.on("data", (chunk) => { output += chunk; if (output.includes("ChatGPT companion:")) { clearTimeout(timer); resolve(); } });
    child.once("exit", () => { clearTimeout(timer); reject(new Error("Companion exited")); });
  });
  const base = `http://127.0.0.1:${port}`;
  const headers = { Origin: "http://localhost:3000", "X-Mafia-Client": "1", "Content-Type": "application/json" };
  assert.equal((await fetch(`${base}/connection`, { headers: { ...headers, Origin: "https://evil.invalid" } })).status, 403);
  assert.equal((await fetch(`${base}/connection`, { headers })).status, 401);
  const options = await fetch(`${base}/connection`, { method: "OPTIONS", headers });
  assert.equal(options.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
  assert.equal(options.headers.get("Access-Control-Allow-Credentials"), null);
  const verifier = "v".repeat(64);
  const start = await (await fetch(`${base}/access/start`, { method: "POST", headers, body: JSON.stringify({ challenge: createHash("sha256").update(verifier).digest("base64url") }) })).json();
  assert.equal(start.needsApproval, false);
  const session = await (await fetch(`${base}/access/finish`, { method: "POST", headers, body: JSON.stringify({ id: start.id, verifier }) })).json();
  assert.equal(typeof session.token, "string");
  const response = await fetch(`${base}/connection`, { headers: { ...headers, "X-Mafia-Session": session.token } });
  assert.equal(response.status, 200);
  const state = await response.json();
  assert.equal(typeof state.connected, "boolean");
  for (const field of ["accessToken", "refreshToken", "idToken", "credentialPath", "clientId"]) assert.equal(Object.hasOwn(state, field), false);
  const authorizedHeaders = { ...headers, "X-Mafia-Session": session.token };
  const connect = await (await fetch(`${base}/connect`, { method: "POST", headers: authorizedHeaders, body: "{}" })).json();
  const launch = new URL(connect.authorizationUrl);
  assert.equal(launch.origin, base);
  assert.equal(launch.pathname, "/authorize");
  assert.equal(connect.authorizationUrl.includes("id_token_hint"), false);
  const redirect = await fetch(launch, { redirect: "manual" });
  assert.equal(redirect.status, 303);
  const authorization = new URL(redirect.headers.get("location"));
  assert.equal(authorization.origin, "https://auth.openai.com");
  assert.equal(authorization.searchParams.get("client_id"), "dynamic_agent_client");
  assert.equal((await fetch(launch, { redirect: "manual" })).status, 410);
  assert.equal((await fetch(`${base}/cancel`, { method: "POST", headers: authorizedHeaders, body: "{}" })).status, 200);
  assert.equal(output.includes("Pairing key:"), false);
});
