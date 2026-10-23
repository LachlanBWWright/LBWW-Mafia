import { expect, it } from "vitest";
import { lobbyRoles, uniqueLobbyRoles } from "@mernmafia/shared/game/lobbyConfig";
import { builtInRoleDefinitions } from "../../roles/composition/catalog";
it("keeps client role identifiers and uniqueness limits aligned with the engine", () => {
  expect(lobbyRoles.map(([id]) => id).sort()).toEqual(builtInRoleDefinitions.filter((entry) => entry.id !== "blank-role").map((entry) => entry.id).sort());
  expect([...uniqueLobbyRoles].sort()).toEqual(builtInRoleDefinitions.filter((entry) => entry.metadata.isUnique).map((entry) => entry.id).sort());
});
