import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createChatGPTRuntime } from "./chatgpt/runtime.mjs";

export const chatGPTRuntime = createChatGPTRuntime({ ...(process.env.MAFIA_CHATGPT_DATA_DIR ? { directory: process.env.MAFIA_CHATGPT_DATA_DIR } : {}) });
export const generateWithChatGPT = (input) => chatGPTRuntime.generate(input);
export const listChatGPTModels = () => chatGPTRuntime.models();
export const chatGPTConnection = () => chatGPTRuntime.connection();

export async function openBrowser(url) {
  const command = process.platform === "darwin" ? ["open", [url]] : process.platform === "win32"
    ? ["rundll32", ["url.dll,FileProtocolHandler", url]] : ["xdg-open", [url]];
  await promisify(execFile)(command[0], command[1]);
}

export async function signInWithChatGPT() {
  const { authorizationUrl } = await chatGPTRuntime.startSignIn();
  await openBrowser(authorizationUrl);
  for (;;) {
    const status = await chatGPTRuntime.connection();
    if (!status.signingIn) {
      if (status.error) throw new Error(status.error.message);
      return { email: status.email ?? "ChatGPT account", credentialPath: chatGPTRuntime.credentialPath };
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
