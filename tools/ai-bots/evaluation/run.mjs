import { pathToFileURL } from "node:url";
import profiles from "../../../shared/game/botProfiles.json" with { type: "json" };
import {
  createDecisionContext,
  hasSupportedAssessment,
} from "../decisionPolicy.mjs";
import {
  decideCharacterActions,
  parseDecisions,
} from "../characterDecisions.mjs";
import { scenarios } from "./scenarios.mjs";

export function evaluateScriptedPolicies({ samples = 200 } = {}) {
  if (!Number.isInteger(samples) || samples < 1)
    throw new Error("samples must be a positive integer.");
  return profiles.difficulties.map(({ id: difficulty }) => {
    let proposed = 0,
      accepted = 0,
      rejectedSafetyCases = 0,
      safetyCases = 0;
    let supportedDeductions = 0,
      deductions = 0,
      accurateTargets = 0,
      targets = 0;
    let acceptedIllegal = 0;
    let aggressive = 0,
      aggressionOpportunities = 0,
      bluffs = 0,
      bluffOpportunities = 0;
    for (let index = 0; index < samples; index++)
      for (const scenario of scenarios) {
        const character = {
          ...scenario.character,
          difficulty,
          personality: "deceptive",
          snapshot: {
            ...scenario.character.snapshot,
            matchId: `evaluation:${index}`,
          },
        };
        const context = createDecisionContext(character);
        const [{ actions }] = parseDecisions(
          JSON.stringify({
            characters: [{ playerName: "Ada", actions: scenario.actions }],
          }),
          [context],
        );
        proposed += scenario.actions.length;
        accepted += actions.length;
        if (scenario.expectedIllegal) acceptedIllegal += actions.length;
        if (scenario.expectedRejected) {
          safetyCases++;
          if (!actions.length) rejectedSafetyCases++;
        }
        if (scenario.expectedTarget) {
          aggressionOpportunities++;
          if (
            actions.some(
              (action) => action.kind === "vote" || action.accusation,
            )
          )
            aggressive++;
        }
        if (scenario.id === "bluff-budget") {
          bluffOpportunities++;
          if (actions.length) bluffs++;
        }
        for (const action of actions) {
          if (action.claim === "deduction" || action.kind === "vote") {
            deductions++;
            if (hasSupportedAssessment(action, context)) supportedDeductions++;
          }
          if (action.kind === "vote" && scenario.expectedTarget) {
            targets++;
            if (action.target === scenario.expectedTarget) accurateTargets++;
          }
        }
      }
    return {
      difficulty,
      proposed,
      accepted,
      acceptedLegalityRate: accepted
        ? (accepted - acceptedIllegal) / accepted
        : null,
      safetyRejectionRate: rejectedSafetyCases / safetyCases,
      evidenceReferenceSupportRate: deductions
        ? supportedDeductions / deductions
        : null,
      scriptedTargetAccuracy: targets ? accurateTargets / targets : null,
      aggressionRate: aggressive / aggressionOpportunities,
      bluffRate: bluffs / bluffOpportunities,
    };
  });
}

export async function evaluateLiveModel(model) {
  const results = [];
  for (const { id: difficulty } of profiles.difficulties)
    for (const scenario of scenarios) {
      const character = {
        ...scenario.character,
        difficulty,
        personality: "deceptive",
      };
      // Only character data goes to the model: expected answers stay in this process.
      const [{ actions }] = await decideCharacterActions({
        mode: "per-character",
        model,
        characters: [character],
      });
      results.push({
        difficulty,
        scenario: scenario.id,
        acceptedActions: actions,
        expectedTarget: scenario.expectedTarget,
        targetMatched: scenario.expectedTarget
          ? actions.some(
              (action) =>
                action.kind === "vote" &&
                action.target === scenario.expectedTarget,
            )
          : null,
      });
    }
  return results;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--live"))
    throw new Error(
      "Usage: node tools/ai-bots/evaluation/run.mjs [--live MODEL]",
    );
  const live = args[0] === "--live";
  const report = {
    mode: live ? "live-model-accepted-actions" : "offline-policy-fixtures",
    note: live
      ? "Uses your ChatGPT plan. Reports accepted decisions after policy filtering; not raw model compliance."
      : "No model calls. Tests policy enforcement with scripted candidates, not model reasoning quality.",
    results: live
      ? await evaluateLiveModel(args[1])
      : evaluateScriptedPolicies(),
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
