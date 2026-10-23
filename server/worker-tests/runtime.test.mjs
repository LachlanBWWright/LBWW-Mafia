import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

// Exercise the deployed Worker entry, Durable Objects and actual WebSockets in
// workerd. The only fake is the Next.js HTTP backend; no Cloudflare account,
// database, remote service or persisted room recovery is required.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const secret = "local-worker-integration-secret";
const sockets = new Set();
let worker;
let backend;
let storage;
let base;
let logs = "";
const backendRequests = [];
const privacyLineups = [
  ["doctor", "mafia", "investigator"],
  ["mafia", "mafia-investigator", "doctor"],
  ["mafia", "mafia-roleblocker", "lawman"],
];

function assertRoleVisibility(snapshots) {
  const privateRoles = new Map(snapshots.map((snapshot) => [snapshot.playerName, snapshot.role.role]));
  const mafiaRoles = new Set(["Mafia", "Mafia Investigator", "Mafia Roleblocker"]);
  for (const snapshot of snapshots) {
    assert.equal(snapshot.players.length, snapshots.length);
    assert.ok(snapshot.role.role);
    for (const player of snapshot.players) {
      const actualRole = privateRoles.get(player.name);
      assert.ok(actualRole, `missing private role for ${player.name}`);
      // Mafia teammates and Lawmen share roles; other living opponents do not.
      const teammate = (mafiaRoles.has(snapshot.role.role) && mafiaRoles.has(actualRole)) ||
        (snapshot.role.role === "Lawman" && actualRole === "Lawman");
      const visible = player.name === snapshot.playerName || teammate;
      assert.equal(player.role, visible ? actualRole : undefined,
        `${snapshot.playerName} (${snapshot.role.role}) viewing ${player.name} (${actualRole})`);
    }
  }
}

const delay = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

async function unusedPort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}

async function eventually(predicate, description, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    if (worker?.exitCode !== null) throw new Error(`Wrangler exited: ${logs}`);
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${description}. Wrangler output:\n${logs}`);
}

function ticket(handle) {
  const payload = Buffer.from(JSON.stringify({
    userId: `worker-test-${handle}`, handle, exp: Date.now() + 120_000,
  })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}

async function connect(room, resume = randomUUID()) {
  const socket = new WebSocket(`${base.replace("http", "ws")}/parties/main/${room}?resume=${resume}`);
  const messages = [];
  socket.on("message", (message) => messages.push(JSON.parse(message.toString())));
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  await once(socket, "open");
  const client = {
    socket, messages, resume,
    send(event, args, extra = {}) {
      socket.send(JSON.stringify({ type: "event", event, args, ...extra }));
    },
    wait(predicate, description, timeout) {
      return eventually(() => messages.find(predicate), description, timeout);
    },
    snapshot(predicate = () => true, timeout) {
      return this.wait((message) => message.event === "game-snapshot" && predicate(message.args[0]), "game snapshot", timeout)
        .then((message) => message.args[0]);
    },
    async join(handle, spectator = false) {
      const callbackId = randomUUID();
      this.send(spectator ? "spectatorJoinRoom" : "playerJoinRoom", ["dev-bypass-token", ticket(handle)], { callbackId });
      const response = await this.wait((message) => message.callbackId === callbackId, "join acknowledgement");
      return response.args[0];
    },
    async command(event, args, phaseVersion, commandId = randomUUID()) {
      const start = messages.length;
      this.send(event, args, { phaseVersion, commandId });
      return eventually(() => messages.slice(start).find((message) => message.type === "command-ack" && message.commandId === commandId), "command acknowledgement");
    },
  };
  return client;
}

before(async () => {
  storage = await mkdtemp(resolve(tmpdir(), "mafia-worker-test-"));
  backend = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    backendRequests.push({ url: request.url, authorization: request.headers.authorization, body: Buffer.concat(chunks).toString() });
    const lineupIndex = request.url.match(/^\/api\/lobbies\/privacy-(\d+)-/u)?.[1];
    const lineup = lineupIndex === undefined ? undefined : privacyLineups[Number(lineupIndex)];
    // Other rooms retain the DEBUG fallback configuration and real match timers.
    response.writeHead(request.url.startsWith("/api/lobbies/") && !lineup ? 404 : 200, { "content-type": "application/json" });
    response.end(JSON.stringify(lineup ? {
      size: lineup.length,
      roleSelection: { algorithm: "explicit-slots", roles: [], explicitSlots: lineup },
    } : {}));
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  const port = await unusedPort();
  base = `http://127.0.0.1:${port}`;
  worker = spawn("pnpm", ["--dir", "server", "exec", "wrangler", "dev", "--config", "../wrangler.jsonc", "--local", "--port", String(port), "--persist-to", storage,
    "--var", "DEBUG:true", "--var", "ROOM_SIZE:3", "--var", "END_DAY:2", "--var", `BACKEND_SECRET:${secret}`,
    "--var", `NEXTJS_URL:http://127.0.0.1:${backend.address().port}`], {
    cwd: root, detached: true, env: { ...process.env, CI: "true", CLOUDFLARE_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = (chunk) => {
    logs = (logs + chunk.toString().split("\n").filter((line) => !line.includes("[wrangler:info] GET")).join("\n")).slice(-15_000);
  };
  worker.stdout.on("data", capture);
  worker.stderr.on("data", capture);
  await eventually(async () => {
    try { return (await fetch(base)).status === 404; } catch { return false; }
  }, "local workerd startup", 60_000);
}, { timeout: 65_000 });

after(async () => {
  for (const socket of sockets) socket.terminate();
  if (worker?.pid) {
    try { process.kill(-worker.pid, "SIGTERM"); } catch { /* Already exited. */ }
    await Promise.race([once(worker, "exit"), delay(3_000)]);
    try { process.kill(-worker.pid, "SIGKILL"); } catch { /* Already exited. */ }
  }
  if (backend) await new Promise((done) => backend.close(done));
  if (storage) await rm(storage, { recursive: true, force: true });
});

test("Worker routes HTTP requests and protects room administration", async () => {
  assert.equal((await fetch(`${base}/unhandled`)).status, 404);
  const url = `${base}/parties/main/admin-${randomUUID()}`;
  assert.equal((await fetch(url)).status, 404);
  assert.equal((await fetch(url, { method: "DELETE", headers: { authorization: "Bearer wrong" } })).status, 404);
  const status = await fetch(url, { headers: { authorization: `Bearer ${secret}` } });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).connections, 0);
  const options = await fetch(url, { method: "OPTIONS", headers: { origin: "http://localhost:3000" } });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), "http://localhost:3000");
});

test("malformed frames are ignored and oversized frames close only their connection", async () => {
  const room = `invalid-${randomUUID()}`;
  const client = await connect(room);
  client.socket.send("{invalid-json");
  client.socket.send(Buffer.from("{invalid-binary-json"));
  client.socket.send(JSON.stringify({ type: "event", event: "unknown-event", args: [] }));
  assert.equal((await client.join("Still connected")).status, "joined");
  const healthy = await connect(room);
  assert.equal((await healthy.join("Healthy peer")).status, "joined");
  const closed = once(client.socket, "close");
  client.socket.send("x".repeat(16_385));
  const [code] = await closed;
  assert.equal(code, 1009);
  assert.equal(healthy.socket.readyState, WebSocket.OPEN);
  const state = await healthy.snapshot((value) => value.players.some((player) => player.name === "Still connected" && player.connected === false));
  assert.equal(state.started, false);
}, { timeout: 10_000 });

test("normal close handshakes finish promptly and reserve the seat", async () => {
  const room = `clean-close-${randomUUID()}`;
  const client = await connect(room);
  await client.join("Leaving player");
  const closed = once(client.socket, "close");
  const started = Date.now();
  client.socket.close(1000, "Leaving");
  const [code] = await closed;
  assert.equal(code, 1000);
  assert.ok(Date.now() - started < 3_000, "close handshake must not wait for the client's 30-second timeout");
  const headers = { authorization: `Bearer ${secret}` };
  await eventually(async () => (await (await fetch(`${base}/parties/main/${room}`, { headers })).json()).reservedSeats === 1, "clean-close seat reservation", 1_000);
}, { timeout: 4_000 });

for (const [index, lineup] of privacyLineups.entries()) {
  test(`live role visibility for explicit lineup: ${lineup.join(", ")}`, async () => {
    const room = `privacy-${index}-${randomUUID()}`;
    const players = [];
    for (let seat = 0; seat < lineup.length; seat++) {
      const client = await connect(room);
      assert.equal((await client.join(`Player ${seat}`)).status, "joined");
      players.push(client);
    }
    const snapshots = await Promise.all(players.map((client) => client.snapshot((value) => value.started && value.role)));
    assert.deepEqual(snapshots.map((snapshot) => snapshot.role.role.toLowerCase().replaceAll(" ", "-")).sort(), [...lineup].sort());
    assert.ok(snapshots.every((snapshot) => !snapshot.ended && snapshot.players.every((player) => player.isAlive)));
    assertRoleVisibility(snapshots);
    const observer = await connect(room);
    assert.equal((await observer.join("Observer", true)).status, "joined");
    const observed = await observer.snapshot((value) => value.started);
    assert.equal(observed.role, undefined);
    assert.ok(observed.players.every((player) => player.role === undefined));
    assert.equal((await fetch(`${base}/parties/main/${room}`, {
      method: "DELETE", headers: { authorization: `Bearer ${secret}` },
    })).status, 204);
  }, { timeout: 10_000 });
}

test("real WebSockets preserve private roles, command semantics, spectators, isolation and reconnects", async () => {
  const room = `match-${randomUUID()}`;
  const first = await connect(room);
  assert.deepEqual(await first.join("Alice"), { status: "joined", username: "Alice" });
  const isolated = await connect(`other-${randomUUID()}`);
  await isolated.join("Other room");
  const second = await connect(room);
  const third = await connect(room);
  await second.join("Bob");
  await third.join("Charlie");
  const players = [first, second, third];
  const snapshots = await Promise.all(players.map((client) => client.snapshot((value) => value.started && value.role)));
  assertRoleVisibility(snapshots);
  const full = await connect(room);
  assert.deepEqual(await full.join("Fourth player"), { status: "rejected", code: 3 });
  const observer = await connect(room);
  assert.equal((await observer.join("Observer", true)).status, "joined");
  const observed = await observer.snapshot((value) => value.started);
  assert.equal(observed.role, undefined);
  assert.ok(observed.players.every((player) => player.role === undefined));

  const snapshot = snapshots[0];
  const text = `Only this room sees ${randomUUID()}`;
  const commandId = randomUUID();
  assert.equal((await first.command("messageSentByUser", [text, snapshot.time], snapshot.phaseVersion, commandId)).accepted, true);
  await second.wait((message) => message.event === "receive-chat-message" && JSON.stringify(message.args).includes(text), "room chat broadcast");
  assert.equal((await first.command("messageSentByUser", [text, snapshot.time], snapshot.phaseVersion, commandId)).accepted, true);
  assert.equal(second.messages.filter((message) => message.event === "receive-chat-message" && JSON.stringify(message.args).includes(text)).length, 1);
  assert.ok(!isolated.messages.some((message) => JSON.stringify(message).includes(text)));
  const stale = await first.command("handleVote", [null, snapshot.time], snapshot.phaseVersion - 1);
  assert.equal(stale.accepted, false);
  assert.equal(stale.reason, "stale-phase");
  const invalid = await first.command("handleVote", ["not-a-player-index", snapshot.time], snapshot.phaseVersion);
  assert.equal(invalid.accepted, false);
  assert.equal(invalid.reason, "invalid-command");
  assert.equal((await first.command("handleVote", [null, snapshot.time], snapshot.phaseVersion)).accepted, true);
  assert.equal((await first.command("handleVisit", [null, snapshot.time], snapshot.phaseVersion)).accepted, true);

  const closed = once(first.socket, "close");
  first.socket.terminate();
  await closed;
  const roomUrl = `${base}/parties/main/${room}`;
  const headers = { authorization: `Bearer ${secret}` };
  await eventually(async () => (await (await fetch(roomUrl, { headers })).json()).reservedSeats === 1, "reserved reconnect seat");
  const resumed = await connect(room, first.resume);
  assert.deepEqual(await resumed.join("Ignored new identity"), { status: "joined", username: "Alice" });
  const restored = await resumed.snapshot((value) => value.role);
  assert.equal(restored.role.role, snapshot.role.role);
  assert.equal(restored.matchId, snapshot.matchId);

  // Timers really elapse in workerd: five seconds of Day 1 followed by a
  // fifteen-second night. Nobody acts lethally, so END_DAY=2 ends the match.
  const ended = await resumed.snapshot((value) => value.ended, 30_000);
  assert.ok(ended.recap);
  assert.equal(ended.recap.players.length, 3);
  assert.ok(ended.recap.players.every((player) => typeof player.role === "string"));
  await eventually(() => backendRequests.find((request) => request.url.startsWith("/api/trpc/match.persist") && request.body.includes(room)), "completed match history upload");
  const history = backendRequests.find((request) => request.url.startsWith("/api/trpc/match.persist") && request.body.includes(room));
  assert.equal(history.authorization, `Bearer ${secret}`);

  const observerClosed = once(observer.socket, "close");
  assert.equal((await fetch(roomUrl, { method: "DELETE", headers })).status, 204);
  const [code] = await observerClosed;
  assert.equal(code, 1000);
  const rejected = new WebSocket(`${base.replace("http", "ws")}/parties/main/${room}`);
  sockets.add(rejected);
  // Room closure may occur immediately after the HTTP upgrade.
  const rejection = once(rejected, "close");
  const [rejectedCode] = await rejection;
  sockets.delete(rejected);
  assert.equal(rejectedCode, 1013);
}, { timeout: 50_000 });
