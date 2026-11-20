import type { createApiBotRuntime } from "./runtime.mjs";
/** Embed the CLI lifecycle with a host-owned registry to expose additional HTTP adapters. */
export function runApiBots(
  file: string,
  ports?: Parameters<typeof createApiBotRuntime>[1],
): Promise<ReturnType<typeof createApiBotRuntime>>;
