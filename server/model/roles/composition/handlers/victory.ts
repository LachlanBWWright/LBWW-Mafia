import type { RoleHandlerDefinition } from "./types.js";

export function victoryHandler(
  handler: Pick<RoleHandlerDefinition, "onPlayerVotedOut" | "onNoDeathDraw">,
): RoleHandlerDefinition {
  return handler;
}
