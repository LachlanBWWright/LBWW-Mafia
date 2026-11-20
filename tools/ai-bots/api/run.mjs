import { readFile, stat } from "node:fs/promises";
import { apiConfigFromEnvironment, createApiBotRuntime } from "./runtime.mjs";

export async function runApiBots(file, ports = {}) {
  if (!file)
    throw new Error("Usage: pnpm run ai-bots -- api-run <seat-options.json>");
  if ((await stat(file)).size > 128_000)
    throw new Error("API bot seat options file is too large.");
  let options;
  try {
    options = JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new Error("API bot seat options must be a JSON file.");
  }
  if (!options || Array.isArray(options) || typeof options !== "object")
    throw new Error("API bot seat options must be a JSON object.");
  const runtime = createApiBotRuntime(
    apiConfigFromEnvironment(process.env, ports),
    ports,
  );
  try {
    runtime.startBotSeats(options);
  } catch (error) {
    runtime.close();
    throw error;
  }
  const stop = () => {
    runtime.close();
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  return runtime;
}
