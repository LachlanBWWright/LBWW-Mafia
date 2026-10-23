import { describe, expect, it } from "vitest";
import {
  createDecisionContext,
  hasSupportedAssessment,
  passesDecisionPolicy,
  policySample,
} from "../../../tools/ai-bots/decisionPolicy.mjs";
import { parseDecisions } from "../../../tools/ai-bots/characterDecisions.mjs";
import { evaluateScriptedPolicies } from "../../../tools/ai-bots/evaluation/run.mjs";

const character = (difficulty = "standard") => ({
  difficulty,
  personality: "deceptive",
  snapshot: {
    playerName: "Ada",
    matchId: "one",
    phaseVersion: 1,
    time: "Day",
    canTalk: true,
    canVote: true,
    players: [
      { name: "Ada", isAlive: true },
      { name: "Bea", isAlive: true },
    ],
  },
  observations: [
    { event: "receive-chat-message", data: "Bea claimed investigator." },
    { event: "receive-chat-message", data: "Bea later claimed doctor." },
  ],
});
const supported = {
  kind: "vote",
  target: "Bea",
  assessment: { confidence: 0.9, evidence: ["observation:0", "observation:1"] },
};

describe("measurable bot policies", () => {
  it("rejects fabricated private references, duplicate evidence and low confidence", () => {
    const context = createDecisionContext(character("challenging"));
    expect(hasSupportedAssessment(supported, context)).toBe(true);
    for (const assessment of [
      { confidence: 1, evidence: ["observation:0", "other-player:private"] },
      { confidence: 1, evidence: ["observation:0", "observation:0"] },
      { confidence: 0.5, evidence: ["observation:0", "observation:1"] },
      { confidence: 2, evidence: ["observation:0", "observation:1"] },
    ])
      expect(
        passesDecisionPolicy({ ...supported, assessment }, context, () => 0),
      ).toBe(false);
  });

  it("applies aggression and bluff allowances without weakening legal action checks", () => {
    const context = createDecisionContext(character("casual"));
    expect(passesDecisionPolicy(supported, context, () => 0.2)).toBe(true);
    expect(passesDecisionPolicy(supported, context, () => 0.5)).toBe(false);
    const bluff = {
      kind: "chat",
      message: "I am the investigator.",
      claim: "bluff",
    };
    expect(passesDecisionPolicy(bluff, context, () => 0.05)).toBe(true);
    expect(passesDecisionPolicy(bluff, context, () => 0.2)).toBe(false);
    expect(
      passesDecisionPolicy(
        { kind: "chat", message: "What did you see?" },
        context,
        () => 0.99,
      ),
    ).toBe(true);
  });

  it("gives each difficulty its own evidence window and needs no hidden state", () => {
    const input = {
      ...character("casual"),
      observations: Array.from({ length: 100 }, (_, index) => ({
        event: "chat",
        data: index,
      })),
    };
    const context = createDecisionContext(input);
    expect(context.observations).toHaveLength(12);
    expect(context.observations[0].data).toBe(88);
    expect(context.evidence).toHaveLength(12);
    expect(JSON.stringify(context)).not.toContain("expectedTarget");
    expect(policySample(context, "bluff")).toEqual(
      policySample(createDecisionContext(input), "bluff"),
    );
  });

  it("rejects self-only visits to others and unknown live-role faction targets", () => {
    const input = character();
    const snapshot = {
      ...input.snapshot,
      time: "Night",
      role: {
        nightVisitSelf: true,
        nightVisitOthers: false,
        nightVisitFaction: false,
      },
    };
    const [result] = parseDecisions(
      JSON.stringify({
        characters: [
          {
            playerName: "Ada",
            actions: [
              { kind: "visit", target: "Bea" },
              { kind: "visit", target: "Ada" },
            ],
          },
        ],
      }),
      [createDecisionContext({ ...input, snapshot })],
    );
    expect(result.actions).toEqual([{ kind: "visit", target: "Ada" }]);
  });

  it("scores safety, source support and incorrect deductions separately without any model request", () => {
    const report = evaluateScriptedPolicies();
    for (const result of report) {
      expect(result.safetyRejectionRate).toBe(1);
      expect(result.acceptedLegalityRate).toBe(1);
      expect(result.evidenceReferenceSupportRate).toBe(1);
      expect(result.scriptedTargetAccuracy).toBeGreaterThan(0);
      expect(result.scriptedTargetAccuracy).toBeLessThan(1);
    }
    expect(report[0].aggressionRate).toBeLessThan(report[1].aggressionRate);
    expect(report[1].aggressionRate).toBeLessThan(report[2].aggressionRate);
    expect(report[0].bluffRate).toBeLessThan(report[1].bluffRate);
    expect(report[1].bluffRate).toBeLessThan(report[2].bluffRate);
  });
});
