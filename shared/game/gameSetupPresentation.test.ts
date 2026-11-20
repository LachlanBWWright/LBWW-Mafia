import { describe, expect, it } from "vitest";
import { publicSetupLines, gameThemeColors } from "./gameSetupPresentation";
import { resolveGameRules } from "./gameRules";
import { createCustomRoleDraft } from "./customRoles";

describe("public setup presentation", () => {
  it("explains custom role abilities without needing secret assignments", () => {
    const setup = { rules: resolveGameRules({}), voteVisibility: "hidden" as const, customRoles: [createCustomRoleDraft()] };
    const text = publicSetupLines(setup).join("\n");
    expect(text).toContain("anonymous ballots");
    expect(text).toContain("Field Medic: town, protect at night");
    expect(text).toContain("consecutive nights");
    expect(text).not.toContain("Possible roles:");
    expect(text).not.toContain("Alice");
  });
  it("shows only the public pool supplied by the server and supported theme choices", () => {
    expect(publicSetupLines({ rules: resolveGameRules({}), voteVisibility: "public", rolePool: ["Doctor"] })).toContain("Possible roles: Doctor");
    expect(gameThemeColors("classic")).toBeUndefined();
    expect(gameThemeColors("noir")?.background).not.toBe(gameThemeColors("midnight")?.background);
  });
});
