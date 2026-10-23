import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import {
  acceptsSender,
  createDesktopController,
  trustedOrigin,
} from "./controller.mjs";
import { createProtectedStore } from "./protectedStore.mjs";

test("desktop trust rejects insecure remote URLs, foreign frames, and arbitrary IPC", async () => {
  assert.equal(
    trustedOrigin("https://mafia.example/lobby"),
    "https://mafia.example",
  );
  assert.equal(trustedOrigin("http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  for (const url of [
    "http://mafia.example",
    "file:///tmp/app.html",
    "https://user:pass@mafia.example",
    "javascript:alert(1)",
  ])
    assert.throws(() => trustedOrigin(url));
  const frame = { url: "https://mafia.example/lobby" };
  const window = { webContents: { mainFrame: frame } };
  assert.equal(
    acceptsSender(
      { sender: window.webContents, senderFrame: frame },
      window,
      "https://mafia.example",
    ),
    true,
  );
  assert.equal(
    acceptsSender(
      { sender: window.webContents, senderFrame: { ...frame } },
      window,
      "https://mafia.example",
    ),
    false,
  );
  assert.equal(
    acceptsSender(
      { sender: {}, senderFrame: frame },
      window,
      "https://mafia.example",
    ),
    false,
  );
  const controller = createDesktopController({});
  await assert.rejects(controller.invoke("generate", { token: "secret" }));
});

test("desktop uses native sign-in, validates model and game origin, and stops bot seats on disconnect", async () => {
  const calls = [];
  let stopped = false;
  const group = [{ close() {} }];
  group.stop = () => {
    stopped = true;
  };
  const runtime = {
    connection: async () => ({
      connected: true,
      planEnabled: true,
      usagePaused: false,
    }),
    startSignIn: async () => ({
      authorizationUrl:
        "https://auth.openai.com/api/accounts/authorize?state=fresh",
    }),
    models: async () => [{ slug: "available", name: "Available" }],
    signOut: async () => {
      assert.equal(stopped, true);
      return { remoteRevocationConfirmed: true };
    },
    close() {},
    cancelSignIn() {},
  };
  const controller = createDesktopController({
    runtime,
    open: async (url) => calls.push(url),
    socketOrigin: "https://game.example",
    runner: { startBotSeats: () => group },
  });
  await controller.invoke("connect");
  assert.match(calls[0], /^https:\/\/auth.openai.com/);
  const body = {
    socketUrl: "https://game.example",
    room: "room",
    tickets: ["signed-ticket"],
    model: "available",
    mode: "per-character",
    personality: "varied",
    difficulty: "standard",
  };
  await assert.rejects(
    controller.invoke("join", {
      ...body,
      socketUrl: "https://attacker.example",
    }),
  );
  await assert.rejects(
    controller.invoke("join", { ...body, model: "unknown" }),
  );
  assert.deepEqual(await controller.invoke("join", body), { added: 1 });
  await controller.invoke("disconnect");
});

test("desktop credentials are encrypted at rest and never fall back to basic text", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "mafia-desktop-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const key = randomBytes(32);
  const iv = randomBytes(16);
  const encryption = {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => "gnome_libsecret",
    encryptString(text) {
      const cipher = createCipheriv("aes-256-cbc", key, iv);
      return Buffer.concat([cipher.update(text), cipher.final()]);
    },
    decryptString(bytes) {
      const cipher = createDecipheriv("aes-256-cbc", key, iv);
      return Buffer.concat([cipher.update(bytes), cipher.final()]).toString();
    },
  };
  const store = createProtectedStore(directory, encryption);
  const credentials = {
    clientId: "oaiapp_test",
    accessToken: "private-token",
    refreshToken: "rotating-token",
  };
  await store.save(credentials);
  assert.deepEqual(await store.load(), credentials);
  assert.equal(
    (await readFile(store.path)).includes(Buffer.from("private-token")),
    false,
  );
  const host = await store.hostId();
  assert.equal(await store.hostId(), host);
  encryption.getSelectedStorageBackend = () => "basic_text";
  await assert.rejects(store.save(credentials), /keychain/);
  await assert.rejects(store.load(), /keychain/);
});
