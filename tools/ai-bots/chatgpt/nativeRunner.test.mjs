import { test } from "node:test";
import assert from "node:assert/strict";
import { createBotRunner } from "../../../shared/ai/partyRunner.mjs";

test("mobile background/resume discards in-flight decisions and resumes the same phase", async (t) => {
  let socket; let release; let started; let resumed;
  const ready = new Promise((resolve) => { started = resolve; });
  const complete = new Promise((resolve) => { resumed = resolve; });
  const pending = new Promise((resolve) => { release = resolve; });
  const sent = [];
  class Socket {
    static OPEN = 1;
    readyState = 1;
    listeners = new Map();
    constructor() { socket = this; }
    on(event, listener) { this.listeners.set(event, listener); }
    send(body) { sent.push(JSON.parse(body)); }
    close() { this.readyState = 3; }
  }
  let turns = 0;
  const runner = createBotRunner({ WebSocket: Socket, randomUUID: () => "id", generate: async () => "", runTurn: async ({ characters }) => {
    turns++;
    if (turns === 1) { started(); await pending; }
    characters[0].socket.emit("messageSentByUser", turns === 1 ? "stale" : "current", "Day");
    if (turns === 2) resumed();
  } });
  const group = runner.startBotSeats({ url: "http://localhost:1999", room: "room", tickets: ["ticket"], model: "model", mode: "shared" });
  t.after(() => group.stop());
  socket.listeners.get("message")(JSON.stringify({ type: "event", event: "game-snapshot", args: [{ playerName: "Alice", matchId: "match", phaseVersion: 1, players: [{ name: "Alice", isAlive: true }], time: "Day" }] }));
  await ready;
  runner.setPaused(true); runner.setPaused(false); release();
  await complete;
  assert.equal(sent.some((message) => message.args?.includes("stale")), false);
  assert.equal(sent.filter((message) => message.args?.includes("current")).length, 1);
});
