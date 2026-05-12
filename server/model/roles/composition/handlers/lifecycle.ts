import type { RoleHandler } from "./types.js";

export function lifecycleHandler(
  handler: Pick<
    RoleHandler,
    "onAttach" | "onInit" | "onDayUpdate" | "onNightCleanup"
  >,
): RoleHandler {
  return handler;
}
