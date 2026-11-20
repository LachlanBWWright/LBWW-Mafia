import type { CustomRole } from "../../shared/game/customRoles";
import type { RoleForm } from "../../shared/game/lobbyConfig";

/** Keep pool controls attached to their stable role IDs while definitions are edited. */
export function reconcileCustomRoleForms(current: Record<string, RoleForm>, roles: readonly CustomRole[]): Record<string, RoleForm> {
  const ids = new Set(roles.map((role) => `custom:${role.id}`));
  const result = Object.fromEntries(Object.entries(current).filter(([id]) => !id.startsWith("custom:") || ids.has(id)));
  for (const id of ids) result[id] ??= { enabled: false, weight: "1", minimum: "0", maximum: "", tier: "" };
  return result;
}
