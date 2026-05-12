import type { RoleHandler } from "./types.js";

export function victoryHandler(
  handler: Pick<RoleHandler, "onPlayerVotedOut" | "onNoDeathDraw">,
): RoleHandler {
  return handler;
}
