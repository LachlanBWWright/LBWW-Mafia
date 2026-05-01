// Public API for role composition system
export type {
  ActionHandler,
  ActionContext,
  ApplyContext,
  ValidationError,
  RoleMetadata,
  RoleEffects,
  CustomRoleDefinition,
} from "./types.js";

export {
  VisitActionHandler,
  ProtectiveActionHandler,
  AggressiveActionHandler,
  InvestigativeActionHandler,
  VoteActionHandler,
} from "./handlers.js";

export { DynamicRole } from "./dynamicRole.js";

export { CustomRoleFactory } from "./customRoleFactory.js";
