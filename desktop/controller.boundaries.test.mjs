import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  acceptsSender,
  createDesktopController,
  trustedOrigin,
} from "./controller.mjs";

const body = {
  socketUrl: "https://game.example",
  room: "room",
  tickets: ["ticket"],
  model: "available",
  mode: "shared",
  personality: "varied",
  difficulty: "standard",
};
function fixture() {
  const groups = [];
  const runtime = {
    connection: mock.fn(async () => ({
      connected: true,
      planEnabled: true,
      usagePaused: false,
    })),
    models: mock.fn(async () => [{ slug: "available", name: "Available" }]),
    startSignIn: mock.fn(async () => ({
      authorizationUrl:
        "https://auth.openai.com/api/accounts/authorize?state=state",
    })),
    cancelSignIn: mock.fn(),
    retryUsage: mock.fn(),
    close: mock.fn(),
    signOut: mock.fn(async () => ({ remoteRevocationConfirmed: false })),
  };
  const runner = {
    startBotSeats: mock.fn((value) => {
      const group = value.tickets.map(() => ({}));
      group.stop = mock.fn();
      groups.push(group);
      return group;
    }),
  };
  const open = mock.fn(async () => {});
  return {
    runtime,
    runner,
    open,
    groups,
    controller: createDesktopController({
      runtime,
      runner,
      open,
      socketOrigin: "https://game.example",
    }),
  };
}

for (const url of [
  "http://remote.example",
  "http://localhost.attacker.example",
  "https://mafia.example?query=1",
  "https://mafia.example#fragment",
  "https://user@mafia.example",
  "ws://localhost",
  "file:///tmp/game",
  "not a URL",
])
  test(`rejects untrusted app origin ${url}`, () =>
    assert.throws(() => trustedOrigin(url)));

test("sender validation fails closed for foreign origins, detached frames and missing metadata", () => {
  const frame = { url: "https://attacker.example" };
  const contents = { mainFrame: frame };
  const window = { webContents: contents };
  for (const event of [
    null,
    {},
    { sender: contents },
    { sender: contents, senderFrame: frame },
  ])
    assert.equal(acceptsSender(event, window, "https://mafia.example"), false);
  frame.url = "invalid";
  assert.equal(
    acceptsSender(
      { sender: contents, senderFrame: frame },
      window,
      "https://mafia.example",
    ),
    false,
  );
});

test("status, model catalog, cancel and retry expose only their intended operations", async () => {
  const f = fixture();
  assert.equal((await f.controller.invoke("status")).connected, true);
  assert.deepEqual(await f.controller.invoke("models"), [
    { slug: "available", name: "Available" },
  ]);
  await f.controller.invoke("cancel");
  await f.controller.invoke("retry");
  assert.equal(f.runtime.cancelSignIn.mock.callCount(), 1);
  assert.equal(f.runtime.retryUsage.mock.callCount(), 1);
  assert.equal(f.runner.startBotSeats.mock.callCount(), 0);
});

for (const url of [
  "not a URL",
  "http://auth.openai.com/api/accounts/authorize",
  "https://auth.openai.com.attacker.example/api/accounts/authorize",
  "https://auth.openai.com/other",
  "https://user:pass@auth.openai.com/api/accounts/authorize",
  "https://auth.openai.com/api/accounts/authorize#unexpected",
])
  test(`invalid authorization address cancels the listener: ${url}`, async () => {
    const f = fixture();
    f.runtime.startSignIn.mock.mockImplementation(async () => ({
      authorizationUrl: url,
    }));
    await assert.rejects(f.controller.invoke("connect"));
    assert.equal(f.open.mock.callCount(), 0);
    assert.equal(f.runtime.cancelSignIn.mock.callCount(), 1);
  });

test("browser launch failure cancels authorization and preserves the original failure", async () => {
  const f = fixture();
  const error = new Error("browser failed");
  f.open.mock.mockImplementation(async () => {
    throw error;
  });
  await assert.rejects(
    f.controller.invoke("connect"),
    (caught) => caught === error,
  );
  assert.equal(f.runtime.cancelSignIn.mock.callCount(), 1);
});

const invalid = [
  null,
  { socketUrl: "invalid" },
  { socketUrl: "https://attacker.example" },
  { socketUrl: "https://game.example/path" },
  { socketUrl: "https://game.example?query=1" },
  { socketUrl: "https://game.example#fragment" },
  { socketUrl: "https://user:pass@game.example" },
  { room: " " },
  { room: "r".repeat(129) },
  { room: 1 },
  { tickets: [] },
  { tickets: Array(1) },
  { tickets: Array(13).fill("ticket") },
  { tickets: [""] },
  { tickets: [1] },
  { tickets: ["t".repeat(4097)] },
  { tickets: null },
  { model: "" },
  { model: "m".repeat(201) },
  { model: 1 },
  { mode: "unknown" },
  { personality: "unknown" },
  { difficulty: "unknown" },
];
for (const [index, patch] of invalid.entries())
  test(`rejects malformed bot configuration ${index} before allocating seats`, async () => {
    const f = fixture();
    await assert.rejects(
      f.controller.invoke(
        "join",
        patch === null ? null : { ...body, ...patch },
      ),
    );
    assert.equal(f.runner.startBotSeats.mock.callCount(), 0);
  });

for (const account of [
  { connected: false, planEnabled: true },
  { connected: true, planEnabled: false },
  { connected: true, planEnabled: true, usagePaused: true },
])
  test(`rejects seats without an active permitted plan: ${JSON.stringify(account)}`, async () => {
    const f = fixture();
    f.runtime.connection.mock.mockImplementation(async () => account);
    await assert.rejects(
      f.controller.invoke("join", body),
      /Connect your ChatGPT plan/,
    );
    assert.equal(f.runtime.models.mock.callCount(), 0);
    assert.equal(f.runner.startBotSeats.mock.callCount(), 0);
  });

test("accepts maximum lengths and seat count, forwards validated settings, and stops every group once", async () => {
  const f = fixture();
  const model = "m".repeat(200);
  f.runtime.models.mock.mockImplementation(async () => [{ slug: model }]);
  const value = {
    ...body,
    room: "r".repeat(128),
    tickets: Array(12).fill("t".repeat(4096)),
    model,
  };
  assert.deepEqual(await f.controller.invoke("join", value), { added: 12 });
  await f.controller.invoke("join", value);
  assert.equal(
    f.runner.startBotSeats.mock.calls[0].arguments[0].url,
    "https://game.example",
  );
  await f.controller.invoke("disconnect");
  f.controller.close();
  f.controller.close();
  for (const group of f.groups) assert.equal(group.stop.mock.callCount(), 1);
  assert.equal(f.runtime.close.mock.callCount(), 1);
});

for (const end of ["disconnect", "close"])
  test(`a pending seat request cannot allocate after ${end}`, async () => {
    const f = fixture();
    let release;
    let started;
    const ready = new Promise((resolve) => {
      started = resolve;
    });
    f.runtime.models.mock.mockImplementation(() => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const joining = f.controller.invoke("join", body);
    await ready;
    if (end === "disconnect") await f.controller.invoke("disconnect");
    else f.controller.close();
    release([{ slug: "available" }]);
    await assert.rejects(joining, /changed|closed/);
    assert.equal(f.runner.startBotSeats.mock.callCount(), 0);
  });

test("closed controllers reject further actions", async () => {
  const f = fixture();
  f.controller.close();
  await assert.rejects(f.controller.invoke("join", body), /closed/);
  assert.equal(f.runtime.connection.mock.callCount(), 0);
});
