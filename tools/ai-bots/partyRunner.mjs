import { randomUUID, timingSafeEqual } from "node:crypto";
import { WebSocket } from "ws";
import { generateWithChatGPT } from "./chatgpt-plan.mjs";
import { runCharacterTurn } from "./characterDecisions.mjs";
import { createBotRunner } from "../../shared/ai/partyRunner.mjs";
export const CHAT_REACT_DEBOUNCE = 5_000;
export const startBotSeats = (options, generate = generateWithChatGPT) =>
  createBotRunner({
    WebSocket,
    randomUUID,
    generate,
    runTurn: runCharacterTurn,
    report: (message) => process.stderr.write(message),
  }).startBotSeats(options);
export function equalSecret(expected, received) {
  const left = Buffer.from(expected);
  const right = Buffer.from(received ?? "");
  return left.length === right.length && timingSafeEqual(left, right);
}
