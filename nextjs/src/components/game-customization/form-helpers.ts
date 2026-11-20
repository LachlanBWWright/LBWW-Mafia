import type { CustomRole } from "@mernmafia/shared/game/customRoles";
import type { RoleForm } from "@mernmafia/shared/game/lobbyConfig";
export function syncCustomRoleForms(
  current: Record<string, RoleForm>,
  roles: CustomRole[],
  enableNewRoles = true,
): Record<string, RoleForm> {
  const next: Record<string, RoleForm> = {};
  for (const [id, form] of Object.entries(current))
    if (!id.startsWith("custom:")) next[id] = form;
  for (const role of roles)
    next[`custom:${role.id}`] = current[`custom:${role.id}`] ?? {
      enabled: enableNewRoles,
      weight: "1",
      minimum: "0",
      maximum: "",
      tier: "",
    };
  return next;
}
export function isUnauthorizedPresetError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("data" in error)) return false;
  const data: unknown = error.data;
  return (
    !!data &&
    typeof data === "object" &&
    "code" in data &&
    data.code === "UNAUTHORIZED"
  );
}
