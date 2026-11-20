import { abortable } from "./cancellation.mjs";
import {
  createDecisionContext,
  passesDecisionPolicy,
} from "./decisionPolicy.mjs";

const aliveNames = (snapshot) =>
  snapshot.players
    .filter((player) => player.isAlive !== false)
    .map((player) => player.name);

export function parseDecisions(text, contexts) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The model returned an invalid character action payload.");
  }
  const decisions = parsed?.characters;
  if (!Array.isArray(decisions) || decisions.length !== contexts.length) {
    throw new Error(
      "The model did not return one action set for each character.",
    );
  }
  const byName = new Map(
    contexts.map((context) => [context.snapshot.playerName, context]),
  );
  const seen = new Set();
  return decisions.map((entry) => {
    const context = byName.get(entry?.playerName);
    const snapshot = context?.snapshot;
    if (
      !snapshot ||
      seen.has(entry.playerName) ||
      !Array.isArray(entry.actions)
    )
      throw new Error("The model returned an unknown or duplicate character.");
    seen.add(entry.playerName);
    const names = new Set(aliveNames(snapshot));
    let voteUsed = false;
    let visitUsed = false;
    const actions = entry.actions.filter((action) => {
      if (!action || !passesDecisionPolicy(action, context)) return false;
      if (action?.kind === "chat")
        return (
          snapshot.canTalk &&
          typeof action.message === "string" &&
          action.message.length > 0 &&
          action.message.length <= 150
        );
      if (action?.kind === "vote") {
        if (voteUsed) return false;
        const valid =
          snapshot.canVote &&
          snapshot.action?.vote === undefined &&
          names.has(action.target) &&
          action.target !== snapshot.playerName &&
          (snapshot.time === "Day" || snapshot.role?.nightVote === true);
        voteUsed ||= valid;
        return valid;
      }
      if (action?.kind === "visit") {
        if (visitUsed) return false;
        const key = snapshot.time === "Day" ? "dayVisit" : "nightVisit";
        const canVisit =
          snapshot.role?.[`${key}Self`] ||
          snapshot.role?.[`${key}Others`] ||
          snapshot.role?.[`${key}Faction`];
        const valid =
          Boolean(canVisit) &&
          names.has(action.target) &&
          (action.target === snapshot.playerName
            ? snapshot.role?.[`${key}Self`]
            : // A living teammate's role is visible in this player-scoped roster;
              // other living roles are hidden by the snapshot contract.
              snapshot.players.find((player) => player.name === action.target)
                  ?.role !== undefined
              ? snapshot.role?.[`${key}Faction`]
              : snapshot.role?.[`${key}Others`]);
        visitUsed ||= valid;
        return valid;
      }
      if (action?.kind === "whisper")
        return (
          snapshot.canTalk &&
          snapshot.time === "Day" &&
          names.has(action.target) &&
          action.target !== snapshot.playerName &&
          typeof action.message === "string" &&
          action.message.length > 0 &&
          action.message.length <= 150
        );
      return false;
    });
    return { playerName: snapshot.playerName, actions };
  });
}

const actionContract = `Return JSON only, in this exact shape: {"characters":[{"playerName":"...","actions":[{"kind":"chat","message":"..."},{"kind":"vote","target":"..."},{"kind":"visit","target":"..."},{"kind":"whisper","target":"...","message":"..."}]}]}. Use only action kinds chat, vote, visit, whisper. Targets must be living players shown in that character's snapshot. Use only targets in the snapshot. Distinguish deductions and deliberate in-character bluffing from confirmed observations. Respect canTalk, canVote, phase, and role visit capabilities. Follow each character's persistent personality and difficulty instructions. Do not vote again when snapshot.action.vote is already set. Never reveal hidden roles from other views. Choose at most one vote and one visit per character. Do not include an action when none is appropriate. Each Day vote and each factual deduction must include assessment:{confidence:0..1,evidence:["observation:0",...]}, referencing only evidence IDs supplied for that character. Confidence is your uncertainty estimate, never a guarantee. On chat/whisper, mark assertions claim:"deduction" or "observation"; deliberate false role claims/misdirection must be claim:"bluff". Mark accusations accusation:true. Ordinary questions and greetings need no claim. The numeric difficulty policy enforces confidence/evidence requirements and deterministic aggression/bluff allowances; do not disguise bluffs or accusations to bypass it. Evidence references are visible sources, not proof a claim is true. Never infer certainty from a player claim alone.`;
const MAX_MEMORY_MESSAGES = 24;

function appendMemory(memory, userTurn, assistantTurn) {
  memory.push(userTurn, assistantTurn);
  if (memory.length > MAX_MEMORY_MESSAGES)
    memory.splice(0, memory.length - MAX_MEMORY_MESSAGES);
}

/**
 * Shared mode makes one plan request for all characters assigned to this local runner.
 * Per-character mode makes isolated requests and only gives each request that player's view.
 */
export async function decideCharacterActions({
  generate,
  mode,
  model,
  characters,
  sharedConversation = [],
  signal,
  onError = () => {},
  onDecision = () => {},
}) {
  if (!["shared", "per-character"].includes(mode))
    throw new Error("Bot mode must be shared or per-character.");
  if (!Array.isArray(characters) || characters.length === 0) return [];
  characters = characters.filter(
    ({ snapshot }) =>
      !snapshot.ended &&
      snapshot.players.find((player) => player.name === snapshot.playerName)
        ?.isAlive !== false,
  );
  if (characters.length === 0) return [];
  const contexts = characters.map(createDecisionContext);
  if (mode === "shared") {
    const memory = sharedConversation;
    const userTurn = {
      role: "user",
      content: JSON.stringify({ characters: contexts }),
    };
    const signals = [
      signal,
      ...characters.map((character) => character.signal),
    ].filter(Boolean);
    const decisionSignal = signals.length
      ? AbortSignal.any(signals)
      : undefined;
    const response = await abortable(
      () =>
        generate({
          signal: decisionSignal,
          model,
          instructions: `${actionContract}\nYou coordinate the supplied characters. Their information is separated by character; never move information from one character's view into another character's public actions.`,
          input: [...memory, userTurn],
        }),
      decisionSignal,
    );
    decisionSignal?.throwIfAborted();
    const decisions = parseDecisions(response, contexts);
    appendMemory(memory, userTurn, {
      role: "assistant",
      content: JSON.stringify({ characters: decisions }),
    });
    for (const decision of decisions) onDecision(decision);
    return decisions;
  }
  if (mode === "per-character") {
    const results = await Promise.allSettled(
      contexts.map(async (context, index) => {
        const memory = characters[index].conversation ?? [];
        const userTurn = {
          role: "user",
          content: JSON.stringify({ characters: [context] }),
        };
        const signals = [signal, characters[index].signal].filter(Boolean);
        const decisionSignal = signals.length
          ? AbortSignal.any(signals)
          : undefined;
        const response = await abortable(
          () =>
            generate({
              signal: decisionSignal,
              model,
              instructions: `${actionContract}\nYou control only ${context.snapshot.playerName}. Do not act for or use private information belonging to any other character.`,
              input: [...memory, userTurn],
            }),
          decisionSignal,
        );
        decisionSignal?.throwIfAborted();
        const [decision] = parseDecisions(response, [context]);
        appendMemory(memory, userTurn, {
          role: "assistant",
          content: JSON.stringify({ characters: [decision] }),
        });
        characters[index].conversation = memory;
        onDecision(decision);
        return decision;
      }),
    );
    for (const [index, result] of results.entries()) {
      if (
        result.status === "rejected" &&
        !signal?.aborted &&
        !characters[index].signal?.aborted
      )
        onError(result.reason, characters[index].snapshot.playerName);
    }
    return results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
  }
}

/** Submit each successful character immediately; another seat's failure cannot hold it back. */
export async function runCharacterTurn({
  generate,
  mode,
  model,
  characters,
  sharedConversation,
  signal,
  onError,
}) {
  const charactersByName = new Map(
    characters.map((character) => [character.snapshot.playerName, character]),
  );
  return decideCharacterActions({
    generate,
    mode,
    model,
    characters,
    sharedConversation,
    signal,
    onError,
    onDecision(decision) {
      const character = charactersByName.get(decision.playerName);
      if (!character?.socket || signal?.aborted || character.signal?.aborted)
        return;
      const { snapshot, socket } = character;
      for (const action of decision.actions) {
        if (action.kind === "chat")
          socket.emit("messageSentByUser", action.message, snapshot.time);
        if (
          action.kind === "vote" ||
          action.kind === "visit" ||
          action.kind === "whisper"
        ) {
          const index = snapshot.players.findIndex(
            (player) => player.name === action.target,
          );
          if (index < 0) continue;
          if (action.kind === "vote")
            socket.emit("handleVote", index, snapshot.time);
          if (action.kind === "visit")
            socket.emit("handleVisit", index, snapshot.time);
          if (action.kind === "whisper")
            socket.emit("handleWhisper", index, action.message, snapshot.time);
        }
      }
    },
  });
}
