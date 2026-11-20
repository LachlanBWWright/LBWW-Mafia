import { describe, expect, it } from "vitest";
import { allRoles } from "./rolesList";
import { roleIcon } from "./roleIcon";

describe("role icons", () => {
  it("provides an icon and faction for every built-in role", () => {
    for (const role of allRoles) {
      expect(roleIcon(role.name)).toEqual({
        icon: expect.not.stringMatching(/^unknown$/),
        faction: role.faction,
      });
    }
  });
  it("supports case differences and handles custom roles without inferring a faction", () => {
    expect(roleIcon("doctor").icon).toBe("medical");
    expect(roleIcon("Custom role")).toEqual({ icon: "unknown", faction: undefined });
  });
});
