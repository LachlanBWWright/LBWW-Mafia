import { describe, expect, it } from "vitest";
import { builtInFactionDefinitions } from "../../factions/composition/catalog.js";
import { builtInRoleDefinitions } from "./catalog.js";
import { RoleTrait } from "./roleTraits.js";

describe("built-in role and faction catalogs", () => {
  it("have unique role and faction ids", () => {
    const roleIds = builtInRoleDefinitions.map((definition) => definition.id);
    const factionIds = builtInFactionDefinitions.map((definition) => definition.id);

    expect(new Set(roleIds).size).toBe(roleIds.length);
    expect(new Set(factionIds).size).toBe(factionIds.length);
  });

  it("have non-empty role metadata and faction names", () => {
    for (const role of builtInRoleDefinitions) {
      expect(role.metadata.name.trim().length).toBeGreaterThan(0);
      expect(role.metadata.category.trim().length).toBeGreaterThan(0);
      expect(role.metadata.summary.trim().length).toBeGreaterThan(0);
      expect(role.metadata.description.trim().length).toBeGreaterThan(0);
      expect(Number.isFinite(role.balance.power)).toBe(true);
      expect(role.metadata.category).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }

    for (const faction of builtInFactionDefinitions) {
      expect(faction.name.trim().length).toBeGreaterThan(0);
      expect(faction.memberTraits.length).toBeGreaterThan(0);
    }
  });

  it("keep faction membership traits aligned between role and faction catalogs", () => {
    const roleTraits = new Set(
      builtInRoleDefinitions.flatMap((definition) => definition.traits),
    );
    const factionTraits = new Set(
      builtInFactionDefinitions.flatMap((definition) => definition.memberTraits),
    );

    for (const trait of factionTraits) {
      expect(roleTraits.has(trait)).toBe(true);
    }

    for (const role of builtInRoleDefinitions) {
      for (const trait of role.traits) {
        if (
          trait === RoleTrait.MafiaFactionMember ||
          trait === RoleTrait.LawmanFactionMember
        ) {
          expect(factionTraits.has(trait)).toBe(true);
        }
      }
    }
  });
});
