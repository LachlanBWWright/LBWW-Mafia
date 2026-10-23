import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { pathToFileURL } from "node:url";
import WebSocket from "ws";

function origin(value, name) {
  const url = new URL(value);
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error(`${name} must be an HTTPS origin (HTTP is allowed locally)`);
  return url.origin;
}

/** Verify a release without creating users, lobbies, or completed matches. */
export async function smokeProduction(env = process.env, { log = console.log, timeout = 15_000 } = {}) {
  if (!env.BACKEND_SECRET) throw new Error("BACKEND_SECRET is required");
  if (env.NEXT_PUBLIC_SOCKET_BACKEND !== "partyserver")
    throw new Error("NEXT_PUBLIC_SOCKET_BACKEND must be partyserver");
  const web = origin(env.PRODUCTION_WEB_URL, "PRODUCTION_WEB_URL");
  const worker = origin(env.NEXT_PUBLIC_SOCKET_URL, "NEXT_PUBLIC_SOCKET_URL");
  const headers = { authorization: `Bearer ${env.BACKEND_SECRET}` };
  const request = (url, options = {}) => fetch(url, {
    ...options, redirect: "manual", signal: AbortSignal.timeout(timeout),
  });

  const health = await request(`${web}/api/health`, { headers });
  assert.equal(health.status, 200, `Web database health returned HTTP ${health.status}`);
  assert.equal((await health.json()).status, "ready", "Web database is not ready");
  log("Production web database: ready");

  const roomId = `deployment-smoke-${randomUUID()}`;
  const roomUrl = `${worker}/parties/main/${roomId}`;
  let roomCreated = false;
  let socket;
  try {
    const denied = await request(roomUrl);
    assert.equal(denied.status, 404, "Unauthenticated room inspection must be denied");
    const room = await request(roomUrl, { headers });
    assert.equal(room.status, 200, `Authenticated room inspection returned HTTP ${room.status}`);
    roomCreated = true;
    const state = await room.json();
    assert.equal(state.roomId, roomId, "Worker returned a different room");
    assert.equal(state.connections, 0, "Smoke room already has connections");
    log("Production Worker authentication and Durable Object: ready");

    socket = new WebSocket(roomUrl.replace(/^http/, "ws"), { handshakeTimeout: timeout });
    // Keep a listener after the handshake, so later transport errors cannot crash CI.
    socket.on("error", () => {});
    await once(socket, "open", { signal: AbortSignal.timeout(timeout) });
    const connected = await request(roomUrl, { headers });
    assert.equal(connected.status, 200, "Connected-room inspection failed");
    assert.equal((await connected.json()).connections, 1, "Worker did not register the WebSocket");
    log("Production WebSocket upgrade and connection tracking: ready");
  } finally {
    try {
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        const closed = once(socket, "close", { signal: AbortSignal.timeout(timeout) });
        socket.close(1000, "Deployment smoke test complete");
        try { await closed; } finally { socket.terminate(); }
      }
    } finally {
      if (roomCreated) {
        const closed = await request(roomUrl, { method: "DELETE", headers });
        assert.equal(closed.status, 204, "Smoke room cleanup failed");
        log("Deployment smoke room closed");
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  smokeProduction().catch((error) => {
    // Never print HTTP bodies, headers, environment variables, or backend secrets.
    console.error(`Production verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
