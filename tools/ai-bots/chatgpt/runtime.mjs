import { homedir } from "node:os";
import { join } from "node:path";
import { createStore } from "./store.mjs";
import { authorize } from "./oauth.mjs";
import { verifyIdentity } from "./protocol.mjs";
import { createChatGPTRuntime as createRuntime } from "../../../shared/ai/runtime.mjs";
export function createChatGPTRuntime({
  directory = join(homedir(), ".config", "lbww-mafia"),
  store = createStore(directory),
  authorizeClient = authorize,
  ...ports
} = {}) {
  return createRuntime({ store, authorizeClient, verifyIdentity, ...ports });
}
