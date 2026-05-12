import type { RoleHandler } from "./types.js";

export function chatHandler(handler: Pick<RoleHandler, "onHandleMessage">): RoleHandler {
  return handler;
}
