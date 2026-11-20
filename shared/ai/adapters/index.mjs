import { adapter as openai } from "./openai.mjs";
import { adapter as anthropic } from "./anthropic.mjs";
import { adapter as compatible } from "./openai-compatible.mjs";
export const builtinApiAdapters = Object.freeze([
  openai,
  anthropic,
  compatible,
]);
