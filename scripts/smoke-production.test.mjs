import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { WebSocketServer } from "ws";
import { smokeProduction } from "./smoke-production.mjs";

async function fixture(t, { health = 200, ready = "ready", rejectAuth = false, exposeRoom = false, rejectSocket = false } = {}) {
  const requests = [];
  let connections = 0;
  const sockets = new WebSocketServer({ noServer: true });
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    const authenticated = request.headers.authorization === "Bearer test-secret";
    if (request.url === "/api/health") {
      response.writeHead(health, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ status: ready }));
    } else if ((!authenticated && !exposeRoom) || rejectAuth) {
      response.writeHead(404).end();
    } else if (request.method === "DELETE") {
      response.writeHead(204).end();
    } else {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ roomId: request.url.split("/").at(-1), connections }));
    }
  });
  server.on("upgrade", (request, socket, head) => {
    if (rejectSocket) { socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return; }
    sockets.handleUpgrade(request, socket, head, (connection) => {
      connections++;
      connection.on("close", () => connections--);
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    for (const socket of sockets.clients) socket.terminate();
    await new Promise((resolve) => sockets.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    requests,
    env: { BACKEND_SECRET: "test-secret", NEXT_PUBLIC_SOCKET_BACKEND: "partyserver", NEXT_PUBLIC_SOCKET_URL: base, PRODUCTION_WEB_URL: base },
    options: { log() {}, timeout: 2000 },
  };
}

test("verifies database, authorization and a real WebSocket, then cleans up", async (t) => {
  const f = await fixture(t);
  await smokeProduction(f.env, f.options);
  assert.equal(f.requests.filter((r) => r.method === "DELETE").length, 1);
  assert.ok(f.requests.filter((r) => r.url.startsWith("/parties/")).every((r) => r.url.includes("deployment-smoke-")));
});

test("fails a broken database before opening a room", async (t) => {
  const f = await fixture(t, { health: 503 });
  await assert.rejects(smokeProduction(f.env, f.options), /database health returned HTTP 503/);
  assert.equal(f.requests.length, 1);
});

test("rejects a deployment-protection redirect", async (t) => {
  const f = await fixture(t, { health: 307 });
  await assert.rejects(smokeProduction(f.env, f.options), /database health returned HTTP 307/);
});

test("rejects a healthy HTTP response with an unavailable database", async (t) => {
  const f = await fixture(t, { ready: "unavailable" });
  await assert.rejects(smokeProduction(f.env, f.options), /Web database is not ready/);
});

test("detects a mismatched shared secret", async (t) => {
  const f = await fixture(t, { rejectAuth: true });
  await assert.rejects(smokeProduction(f.env, f.options), /Authenticated room inspection returned HTTP 404/);
});

test("rejects an exposed administrative endpoint", async (t) => {
  const f = await fixture(t, { exposeRoom: true });
  await assert.rejects(smokeProduction(f.env, f.options), /Unauthenticated room inspection must be denied/);
});

test("cleans up the created room when WebSocket upgrading fails", async (t) => {
  const f = await fixture(t, { rejectSocket: true });
  await assert.rejects(smokeProduction(f.env, f.options));
  assert.equal(f.requests.filter((r) => r.method === "DELETE").length, 1);
});

test("requires the secret and PartyServer before sending requests", async () => {
  await assert.rejects(smokeProduction({}), /BACKEND_SECRET is required/);
  await assert.rejects(smokeProduction({ BACKEND_SECRET: "test" }), /must be partyserver/);
});

test("rejects insecure remote endpoints and embedded credentials", async (t) => {
  const f = await fixture(t);
  for (const url of ["http://remote.example", "https://user:password@example.com", "https://example.com/path"])
    await assert.rejects(smokeProduction({ ...f.env, NEXT_PUBLIC_SOCKET_URL: url }, f.options), /must be an HTTPS origin/);
  assert.equal(f.requests.length, 0);
});
