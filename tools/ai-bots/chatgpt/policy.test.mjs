import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createDecisionContext,
  hasSupportedAssessment,
  passesDecisionPolicy,
  policySample,
} from "../../../shared/ai/decisionPolicy.mjs";

function context(patch = {}) {
  return createDecisionContext({
    personality: "deceptive",
    difficulty: "challenging",
    observations: [
      { event: "public", data: "claim" },
      { event: "private", data: "result" },
    ],
    snapshot: {
      playerName: "Alice",
      matchId: "match",
      phaseVersion: 1,
      time: "Day",
      players: [
        { name: "Alice", role: "Mafia" },
        { name: "Bob", voteTarget: "Alice" },
        { name: "Unknown" },
      ],
    },
    ...patch,
  });
}
test("context includes only provided evidence, caps its window, and rejects unknown policies", () => {
  const view = context();
  assert.deepEqual(
    view.evidence.map(({ id }) => id),
    ["observation:0", "observation:1", "player:0", "player:1"],
  );
  const bounded = context({
    difficulty: "casual",
    observations: Array.from({ length: 100 }, (_, index) => ({ data: index })),
  });
  assert.equal(bounded.observations.length, 12);
  assert.equal(bounded.observations[0].data, 88);
  assert.deepEqual(context({ observations: undefined }).observations, []);
  for (const patch of [{ personality: "unknown" }, { difficulty: "unknown" }])
    assert.throws(() => context(patch), /Unknown/);
});
test("assessment requires distinct available evidence and finite sufficient confidence", () => {
  const view = context();
  const valid = { confidence: 1, evidence: ["observation:0", "observation:1"] };
  assert.equal(hasSupportedAssessment({ assessment: valid }, view), true);
  for (const assessment of [
    null,
    {},
    { ...valid, confidence: NaN },
    { ...valid, confidence: -1 },
    { ...valid, confidence: 1.1 },
    { ...valid, evidence: null },
    { ...valid, evidence: [] },
    { ...valid, evidence: ["observation:0", "observation:0"] },
    { ...valid, evidence: ["observation:0", "invented"] },
  ])
    assert.equal(hasSupportedAssessment({ assessment }, view), false);
});
test("numeric aggression and bluff policies enforce boundaries without restricting ordinary questions", () => {
  const view = context();
  const vote = {
    kind: "vote",
    assessment: { confidence: 1, evidence: ["observation:0", "observation:1"] },
  };
  assert.equal(
    passesDecisionPolicy(vote, view, () => 0),
    true,
  );
  assert.equal(
    passesDecisionPolicy(vote, view, () => 1),
    false,
  );
  assert.equal(
    passesDecisionPolicy({ kind: "chat", claim: "bluff" }, view, () => 0),
    true,
  );
  assert.equal(
    passesDecisionPolicy({ kind: "chat", claim: "bluff" }, view, () => 1),
    false,
  );
  assert.equal(
    passesDecisionPolicy(
      { kind: "chat", claim: "bluff", accusation: true },
      view,
      (_view, kind) => (kind === "bluff" ? 0 : 1),
    ),
    false,
  );
  assert.equal(
    passesDecisionPolicy(
      { kind: "chat", message: "What happened?" },
      view,
      () => {
        throw new Error("must not sample");
      },
    ),
    true,
  );
});
test("policy samples remain stable for retry and change with phase and evidence", () => {
  const view = context();
  const first = policySample(view, "aggression");
  assert.equal(policySample(view, "aggression"), first);
  assert.ok(first >= 0 && first < 1);
  assert.notEqual(
    policySample(
      { ...view, snapshot: { ...view.snapshot, phaseVersion: 2 } },
      "aggression",
    ),
    first,
  );
  assert.notEqual(policySample({ ...view, evidence: [] }, "aggression"), first);
});
