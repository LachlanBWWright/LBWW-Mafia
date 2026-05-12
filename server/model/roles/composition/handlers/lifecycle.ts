import type { RoleHandlerDefinition } from "./types.js";

export function lifecycleHandler(
  handler: Pick<
    RoleHandlerDefinition,
    "onAttach" | "onInit" | "onDayUpdate" | "onNightCleanup"
  >,
): RoleHandlerDefinition {
  return handler;
}
