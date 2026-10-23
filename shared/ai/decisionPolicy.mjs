import profiles from "../game/botProfiles.json" with { type: "json" };

/** Policies use only player-scoped evidence; they never inspect hidden game state. */
export function createDecisionContext(character) {
  const personality = profiles.personalities.find(
    (p) => p.id === (character.personality ?? "cautious"),
  );
  const difficulty = profiles.difficulties.find(
    (p) => p.id === (character.difficulty ?? "standard"),
  );
  if (!personality || !difficulty)
    throw new Error("Unknown bot personality or difficulty.");
  const observations = (character.observations ?? []).slice(
    -difficulty.policy.evidenceWindow,
  );
  const evidence = observations.map((observation, index) => ({
    ...observation,
    id: `observation:${index}`,
  }));
  // Visible revealed roles and votes are legitimate evidence, but a name alone is not.
  for (const [index, player] of character.snapshot.players.entries()) {
    if (player.role !== undefined || player.voteTarget !== undefined)
      evidence.push({ id: `player:${index}`, data: player });
  }
  return {
    personality,
    difficulty,
    snapshot: character.snapshot,
    observations,
    evidence,
  };
}

/** Stable across retries of the same turn, so retries cannot reroll a rejected bluff. */
export function policySample(context, kind) {
  const seed = JSON.stringify([
    context.snapshot.matchId,
    context.snapshot.phaseVersion,
    context.snapshot.playerName,
    context.evidence,
    kind,
  ]);
  let hash = 2166136261;
  for (const letter of seed)
    hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

export function hasSupportedAssessment(action, context) {
  const assessment = action.assessment;
  const policy = context.difficulty.policy;
  if (
    !assessment ||
    !Number.isFinite(assessment.confidence) ||
    assessment.confidence < policy.minimumConfidence ||
    assessment.confidence > 1 ||
    !Array.isArray(assessment.evidence)
  )
    return false;
  const validIds = new Set(context.evidence.map((evidence) => evidence.id));
  const sources = new Set(assessment.evidence);
  return (
    sources.size >= policy.minimumEvidence &&
    [...sources].every((id) => validIds.has(id))
  );
}

export function passesDecisionPolicy(action, context, sample = policySample) {
  const policy = context.difficulty.policy;
  if (action.claim === "bluff") {
    const rate = Math.min(
      1,
      policy.bluffRate * context.personality.bluffMultiplier,
    );
    if (sample(context, "bluff") >= rate) return false;
  } else if (
    action.claim === "deduction" ||
    action.claim === "observation" ||
    (action.kind === "vote" && context.snapshot.time === "Day")
  ) {
    if (!hasSupportedAssessment(action, context)) return false;
  }
  if (
    (action.kind === "vote" && context.snapshot.time === "Day") ||
    action.accusation === true
  ) {
    const rate = Math.min(
      1,
      policy.aggressionRate * context.personality.aggressionMultiplier,
    );
    if (sample(context, "aggression") >= rate) return false;
  }
  return true;
}
