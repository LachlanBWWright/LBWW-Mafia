import { allRoles } from "@mernmafia/shared/game/rolesList";

/**
 * Map of role names to their descriptions and abilities.
 * Derived from the shared role catalog so the client stays in sync with the app role pages.
 */
export const roles = new Map(
  [...allRoles]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((role) => [role.name, role.description] as const),
);
