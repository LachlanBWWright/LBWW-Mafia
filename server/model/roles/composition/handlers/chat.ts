import type { RoleHandlerDefinition } from "./types.js";

export function chatHandler(handler: Pick<RoleHandlerDefinition, "onHandleMessage">): RoleHandlerDefinition {
  return handler;
}
