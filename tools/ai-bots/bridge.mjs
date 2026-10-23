import profiles from "../../shared/game/botProfiles.json" with { type: "json" };
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { startBotSeats } from "./partyRunner.mjs";
import { chatGPTRuntime, openBrowser } from "./chatgpt-plan.mjs";
import { random } from "./chatgpt/oauth.mjs";
import { createAccess, isLoopback } from "./chatgpt/access.mjs";

const port = Number(process.env.MAFIA_AI_BOT_PORT ?? 43117);
const host = process.env.MAFIA_AI_BOT_HOST ?? "127.0.0.1";
const origins = (process.env.MAFIA_AI_ALLOWED_ORIGINS ?? `http://localhost:${process.env.WEB_PORT ?? 3000},http://127.0.0.1:${process.env.WEB_PORT ?? 3000}`).split(",").map((value) => new URL(value.trim()).origin);
const socketOrigins = (process.env.MAFIA_AI_SOCKET_ORIGINS ?? process.env.NEXT_PUBLIC_SOCKET_URL ?? `http://localhost:${process.env.PARTYSERVER_PORT ?? 1999}`).split(",").map((value) => new URL(value.trim()).origin);
const seats = new Set();
const access = createAccess();
const launches = new Map();
const addresses = ["127.0.0.1", "localhost", ...Object.values(networkInterfaces()).flatMap((list) => (list ?? []).filter((item) => item.family === "IPv4").map((item) => item.address))];
const stopSeats = () => { for (const seat of seats) seat.close(); seats.clear(); };
const json = (response, status, body) => response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(body));
async function readBody(request) {
  let raw = "";
  for await (const chunk of request) { raw += chunk; if (Buffer.byteLength(raw) > 32_000) throw new Error("Request too large"); }
  return raw;
}
const server = createServer(async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  const address = request.socket.remoteAddress;
  if (!addresses.some((hostname) => request.headers.host === `${hostname}:${port}`)) { json(response, 403, { error: "Connection host was not accepted." }); return; }
  // OAuth URLs can contain an ID-token hint. Return only an opaque launch ticket to the UI.
  if (request.method === "GET" && request.url?.startsWith("/authorize?") && isLoopback(address)) {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const ticket = url.searchParams.get("launch");
    const launch = launches.get(ticket); launches.delete(ticket);
    if (!launch || launch.expiresAt < Date.now() || url.searchParams.getAll("launch").length !== 1) {
      json(response, 410, { error: "Sign-in expired. Return to Mafia and try again." }); return;
    }
    response.writeHead(303, { Location: launch.url, "Referrer-Policy": "no-referrer" }).end(); return;
  }
  // Approval can only be made in a browser running on this computer, with a one-time CSRF value.
  if (request.url?.startsWith("/approve") && isLoopback(address)) {
    response.setHeader("Content-Security-Policy", "default-src 'none'; form-action 'self'; frame-ancestors 'none'");
    if (request.method === "GET") {
      const html = access.approval(new URL(request.url, `http://127.0.0.1:${port}`).searchParams.get("id"));
      response.writeHead(html ? 200 : 410, { "content-type": "text/html; charset=utf-8" }).end(html ?? "Connection expired."); return;
    }
    if (request.method === "POST" && request.headers.origin === `http://127.0.0.1:${port}`) {
      const body = new URLSearchParams(await readBody(request).catch(() => ""));
      const approved = access.approve(body.get("id"), body.get("csrf"));
      response.writeHead(approved ? 200 : 403, { "content-type": "text/plain" }).end(approved ? "Connection approved. Return to Mafia." : "Connection expired."); return;
    }
    response.writeHead(403).end(); return;
  }
  const origin = request.headers.origin ?? request.headers["x-mafia-origin"];
  if (!origins.includes(origin)) { json(response, 403, { error: "Open Mafia from a trusted address to connect ChatGPT." }); return; }
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Mafia-Client, X-Mafia-Session, X-Mafia-Origin", "Access-Control-Max-Age": "60", "Access-Control-Allow-Private-Network": "true" }).end(); return;
  }
  if (request.headers["x-mafia-client"] !== "1") { json(response, 403, { error: "Invalid connection request." }); return; }
  try {
    const path = request.url;
    const body = request.method === "POST" ? JSON.parse(await readBody(request)) : null;
    if (request.method === "POST" && path === "/access/start") {
      const session = access.start(body?.challenge, origin, address);
      if (!session) { json(response, 429, { error: "Unable to connect. Try again shortly." }); return; }
      if (session.needsApproval) await openBrowser(`http://127.0.0.1:${port}/approve?id=${session.id}`);
      json(response, 200, session); return;
    }
    if (request.method === "POST" && path === "/access/finish") {
      const result = access.finish(body?.id, body?.verifier, origin, address);
      json(response, result ? 200 : 401, result ?? { error: "Connection expired. Try again." }); return;
    }
    if (!access.verify(request.headers["x-mafia-session"], origin, address)) { json(response, 401, { error: "Reconnect to the ChatGPT companion." }); return; }
    if (request.method === "GET" && path === "/connection") { json(response, 200, await chatGPTRuntime.connection()); return; }
    if (request.method === "POST" && path === "/connect") {
      const result = await chatGPTRuntime.startSignIn();
      if (!isLoopback(address)) { await openBrowser(result.authorizationUrl); json(response, 200, { onCompanion: true }); }
      else {
        for (const [key, launch] of launches) if (launch.expiresAt < Date.now()) launches.delete(key);
        const ticket = random(); launches.set(ticket, { url: result.authorizationUrl, expiresAt: Date.now() + 60_000 });
        json(response, 200, { authorizationUrl: `http://127.0.0.1:${port}/authorize?launch=${ticket}` });
      }
      return;
    }
    if (request.method === "POST" && path === "/cancel") { launches.clear(); chatGPTRuntime.cancelSignIn(); json(response, 200, {}); return; }
    if (request.method === "POST" && path === "/disconnect") { launches.clear(); stopSeats(); json(response, 200, await chatGPTRuntime.signOut()); return; }
    if (request.method === "POST" && path === "/retry") { chatGPTRuntime.retryUsage(); json(response, 200, {}); return; }
    if (request.method === "GET" && path === "/models") { json(response, 200, { models: await chatGPTRuntime.models() }); return; }
    if (request.method !== "POST" || path !== "/join") { json(response, 404, { error: "Not found." }); return; }
    let socket;
    try { socket = new URL(body?.socketUrl); } catch { /* rejected below */ }
    if (!socket || !socketOrigins.includes(socket.origin) || socket.username || socket.password || socket.search || socket.hash ||
        typeof body.room !== "string" || !body.room.trim() || body.room.length > 128 ||
        !Array.isArray(body.tickets) || body.tickets.length < 1 || body.tickets.length > 12 ||
        !body.tickets.every((ticket) => typeof ticket === "string" && ticket.length > 0 && ticket.length <= 4096) ||
        typeof body.model !== "string" || !["shared", "per-character"].includes(body.mode) ||
        (body.personality !== "varied" && !profiles.personalities.some((item) => item.id === body.personality)) ||
        !profiles.difficulties.some((item) => item.id === body.difficulty)) {
      json(response, 400, { error: "Invalid AI character configuration." }); return;
    }
    if (seats.size + body.tickets.length > 12) { json(response, 409, { error: "This connection already controls 12 AI characters." }); return; }
    const models = await chatGPTRuntime.models();
    if (!models.some((model) => model.slug === body.model)) { json(response, 400, { error: "Choose a model available to your ChatGPT account." }); return; }
    const added = startBotSeats({ url: socket.origin, room: body.room, captcha: "", tickets: body.tickets, mode: body.mode, model: body.model, personality: body.personality, difficulty: body.difficulty });
    for (const seat of added) { seats.add(seat); seat.socket.on("close", () => seats.delete(seat)); }
    json(response, 202, { added: added.length });
  } catch (error) {
    json(response, 502, { code: error.code ?? "unavailable", error: error.code ? error.message : "Could not connect to ChatGPT. Try again." });
  }
});
server.requestTimeout = 15_000;
server.listen(port, host, () => {
  process.stdout.write(`ChatGPT companion: http://127.0.0.1:${port}\nConnect your ChatGPT plan from Add AI characters in Mafia.\n`);
});
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
  process.on(signal, () => { stopSeats(); chatGPTRuntime.close(); access.clear(); server.closeAllConnections(); server.close(() => process.exit(0)); });
