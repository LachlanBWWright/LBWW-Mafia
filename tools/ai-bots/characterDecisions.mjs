import { generateWithChatGPT } from "./chatgpt-plan.mjs";
import {
  decideCharacterActions as generate,
  runCharacterTurn as run,
} from "../../shared/ai/characterDecisions.mjs";
export { parseDecisions } from "../../shared/ai/characterDecisions.mjs";
export const decideCharacterActions = (options) =>
  generate({ ...options, generate: options.generate ?? generateWithChatGPT });
export const runCharacterTurn = (options) =>
  run({ ...options, generate: options.generate ?? generateWithChatGPT });
