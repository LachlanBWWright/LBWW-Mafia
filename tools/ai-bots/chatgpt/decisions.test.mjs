import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  decideCharacterActions,
  parseDecisions,
  runCharacterTurn,
} from "../../../shared/ai/characterDecisions.mjs";
import { createDecisionContext } from "../../../shared/ai/decisionPolicy.mjs";

function character(patch = {}) {
  return {
    snapshot: {
      playerName: "Alice",
      matchId: "match",
      phaseVersion: 1,
      time: "Day",
      canTalk: true,
      canVote: true,
      players: [
        { name: "Alice", isAlive: true },
        { name: "Bob", isAlive: true },
        { name: "Dead", isAlive: false },
        { name: "Team", isAlive: true, role: "Mafia" },
      ],
      role: {
        dayVisitSelf: true,
        dayVisitOthers: true,
        dayVisitFaction: true,
        nightVisitSelf: true,
        nightVisitOthers: true,
        nightVisitFaction: true,
        nightVote: true,
      },
      ...patch,
    },
    observations: [],
    conversation: [],
    socket: { emit: mock.fn() },
  };
}
function parse(actions, patch = {}) {
  const context = createDecisionContext(character(patch));
  context.difficulty = {
    policy: {
      minimumConfidence: 0,
      minimumEvidence: 0,
      aggressionRate: 1,
      bluffRate: 1,
    },
  };
  context.personality = { aggressionMultiplier: 1, bluffMultiplier: 1 };
  return parseDecisions(
    JSON.stringify({ characters: [{ playerName: "Alice", actions }] }),
    [context],
  )[0].actions;
}
const vote = (target = "Bob") => ({
  kind: "vote",
  target,
  assessment: { confidence: 1, evidence: [] },
});

for (const text of [
  "invalid JSON",
  "null",
  "{}",
  '{"characters":[]}',
  '{"characters":[null]}',
  '{"characters":[{"playerName":"Unknown","actions":[]}]}',
  '{"characters":[{"playerName":"Alice","actions":null}]}',
])
  test(`rejects malformed character decisions ${text}`, () =>
    assert.throws(() =>
      parseDecisions(text, [createDecisionContext(character())]),
    ));

test("duplicate character output is rejected even if the total count is correct", () => {
  const alice = createDecisionContext(character());
  const bob = createDecisionContext(character({ playerName: "Bob" }));
  assert.throws(
    () =>
      parseDecisions(
        JSON.stringify({
          characters: [
            { playerName: "Alice", actions: [] },
            { playerName: "Alice", actions: [] },
          ],
        }),
        [alice, bob],
      ),
    /duplicate/,
  );
});
test("chat and whisper require valid length, living targets, permission and day phase", () => {
  const chat = { kind: "chat", message: "x".repeat(150) };
  assert.deepEqual(
    parse([
      null,
      { kind: "unknown" },
      { ...chat, message: "" },
      { ...chat, message: 1 },
      { ...chat, message: "x".repeat(151) },
      chat,
    ]),
    [chat],
  );
  assert.deepEqual(parse([chat], { canTalk: false }), []);
  const whisper = { kind: "whisper", target: "Bob", message: "hello" };
  assert.deepEqual(parse([whisper]), [whisper]);
  for (const patch of [
    { target: "Alice" },
    { target: "Dead" },
    { target: "Missing" },
    { message: "" },
    { message: 1 },
    { message: "x".repeat(151) },
  ])
    assert.deepEqual(parse([{ ...whisper, ...patch }]), []);
  assert.deepEqual(parse([whisper], { time: "Night" }), []);
  assert.deepEqual(parse([whisper], { canTalk: false }), []);
});
test("votes honor phase, existing vote, living targets and one accepted vote per turn", () => {
  assert.deepEqual(
    parse([vote("Dead"), vote("Alice"), vote("Missing"), vote(), vote("Team")]),
    [vote()],
  );
  assert.deepEqual(parse([vote()], { action: { vote: 0 } }), []);
  assert.deepEqual(parse([vote()], { canVote: false }), []);
  assert.deepEqual(parse([vote()], { time: "Night", role: {} }), []);
  assert.deepEqual(
    parse([vote()], { time: "Night", role: { nightVote: true } }),
    [vote()],
  );
});
test("visits distinguish self, other and visible faction targets in both phases", () => {
  for (const time of ["Day", "Night"]) {
    const key = time === "Day" ? "dayVisit" : "nightVisit";
    for (const [target, permission] of [
      ["Alice", "Self"],
      ["Bob", "Others"],
      ["Team", "Faction"],
    ]) {
      const visit = { kind: "visit", target };
      assert.deepEqual(
        parse([visit], { time, role: { [`${key}${permission}`]: true } }),
        [visit],
      );
      assert.deepEqual(parse([visit], { time, role: {} }), []);
    }
    assert.deepEqual(
      parse(
        [
          { kind: "visit", target: "Missing" },
          { kind: "visit", target: "Bob" },
          { kind: "visit", target: "Alice" },
        ],
        { time },
      ),
      [{ kind: "visit", target: "Bob" }],
    );
  }
});
test("day votes and labeled assertions without evidence never become accepted actions", () => {
  const context = createDecisionContext(character());
  const actions = [
    vote(),
    { kind: "chat", message: "A claim", claim: "deduction" },
    { kind: "chat", message: "A claim", claim: "observation" },
  ];
  assert.deepEqual(
    parseDecisions(
      JSON.stringify({ characters: [{ playerName: "Alice", actions }] }),
      [context],
    )[0].actions,
    [],
  );
});
test("empty, dead and finished rosters never invoke inference; invalid modes fail", async () => {
  const generate = mock.fn();
  for (const characters of [
    [],
    undefined,
    [character({ ended: true })],
    [character({ players: [{ name: "Alice", isAlive: false }] })],
  ])
    assert.deepEqual(
      await decideCharacterActions({
        generate,
        mode: "shared",
        model: "model",
        characters,
      }),
      [],
    );
  assert.equal(generate.mock.callCount(), 0);
  await assert.rejects(
    decideCharacterActions({ mode: "unknown", characters: [] }),
    /mode/,
  );
});
test("runCharacterTurn emits correct game commands with player indexes and phase", async () => {
  const alice = character();
  const generate = async () =>
    JSON.stringify({
      characters: [
        {
          playerName: "Alice",
          actions: [
            { kind: "chat", message: "hello" },
            { kind: "whisper", target: "Bob", message: "private" },
            { kind: "visit", target: "Team" },
          ],
        },
      ],
    });
  await runCharacterTurn({
    generate,
    mode: "shared",
    model: "model",
    characters: [alice],
  });
  assert.deepEqual(
    alice.socket.emit.mock.calls.map((call) => call.arguments),
    [
      ["messageSentByUser", "hello", "Day"],
      ["handleWhisper", 1, "private", "Day"],
      ["handleVisit", 3, "Day"],
    ],
  );
  alice.snapshot.time = "Night";
  alice.socket.emit.mock.resetCalls();
  await runCharacterTurn({
    generate: async () =>
      JSON.stringify({
        characters: [{ playerName: "Alice", actions: [vote()] }],
      }),
    mode: "per-character",
    model: "model",
    characters: [alice],
  });
  assert.deepEqual(alice.socket.emit.mock.calls[0].arguments, [
    "handleVote",
    1,
    "Night",
  ]);
  alice.socket = undefined;
  await runCharacterTurn({
    generate,
    mode: "shared",
    model: "model",
    characters: [alice],
  });
});
test("bounded memory retains accepted turns and never appends malformed decisions", async () => {
  const alice = character();
  const sharedConversation = [];
  const generate = async () =>
    JSON.stringify({ characters: [{ playerName: "Alice", actions: [] }] });
  for (let turn = 0; turn < 15; turn++)
    await decideCharacterActions({
      generate,
      mode: "shared",
      model: "model",
      characters: [alice],
      sharedConversation,
    });
  assert.equal(sharedConversation.length, 24);
  const before = structuredClone(sharedConversation);
  await assert.rejects(
    decideCharacterActions({
      generate: async () => "bad JSON",
      mode: "shared",
      model: "model",
      characters: [alice],
      sharedConversation,
    }),
  );
  assert.deepEqual(sharedConversation, before);
});
