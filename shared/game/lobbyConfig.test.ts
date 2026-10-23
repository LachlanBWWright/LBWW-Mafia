import { describe, expect, it } from "vitest";
import {
  initialRoleForms,
  lobbyConfigSchema,
  parseLobbyForm,
  selectLobbyRoles,
} from "./lobbyConfig";
const parse = (
  roles: unknown[],
  algorithm = "weighted-random",
  size = 4,
  explicitSlots: string[] = [],
) =>
  lobbyConfigSchema.safeParse({
    size,
    roleSelection: { algorithm, roles, explicitSlots },
  });
describe("custom lobby contract", () => {
  it("rejects unknown roles, duplicates, impossible capacities, and invalid counts", () => {
    expect(parse([{ role: "invented" }]).success).toBe(false);
    expect(parse([{ role: "doctor" }, { role: "doctor" }]).success).toBe(false);
    expect(parse([{ role: "doctor", minimum: 5 }]).success).toBe(false);
    expect(parse([{ role: "doctor", maximum: 2 }]).success).toBe(false);
    expect(parse([{ role: "doctor", weight: 0 }]).success).toBe(false);
    expect(parse([{ role: "jailor", minimum: 2 }]).success).toBe(false);
    expect(parse([{ role: "doctor" }], "weighted-random", 65).success).toBe(
      false,
    );
  });
  it("enforces explicit slot counts and unique roles", () => {
    expect(parse([], "explicit-slots", 4, ["doctor"]).success).toBe(false);
    expect(parse([], "explicit-slots", 2, ["jailor", "jailor"]).success).toBe(
      false,
    );
    const result = parse([], "explicit-slots", 2, [
      "mafia-investigator",
      "doctor",
    ]);
    expect(result.success).toBe(true);
    if (result.success)
      expect(selectLobbyRoles(result.data)).toEqual([
        "mafia-investigator",
        "doctor",
      ]);
  });
  it("honors minimums, weights, caps, and uniqueness for a complete roster", () => {
    const result = parse([
      { role: "doctor", minimum: 2, maximum: 2, weight: 0 },
      { role: "jailor", minimum: 1 },
      { role: "mafia", minimum: 1 },
    ]);
    if (!result.success) throw result.error;
    expect(selectLobbyRoles(result.data, () => 0)).toEqual([
      "doctor",
      "doctor",
      "jailor",
      "mafia",
    ]);
  });
  it("balances the available tiers and applies weights within them", () => {
    const result = parse(
      [
        { role: "doctor", tier: 0 },
        { role: "mafia", tier: 1 },
      ],
      "tier-balanced",
      6,
    );
    if (!result.success) throw result.error;
    const roster = selectLobbyRoles(result.data, () => 0);
    expect(roster.filter((role) => role === "doctor")).toHaveLength(3);
    expect(roster.filter((role) => role === "mafia")).toHaveLength(3);
  });
  it("uses the same form validation on both clients", () => {
    const forms = initialRoleForms();
    expect(parseLobbyForm("8", "weighted-random", forms, "").success).toBe(
      false,
    );
    forms.doctor!.enabled = true;
    expect(parseLobbyForm("8", "weighted-random", forms, "").success).toBe(
      true,
    );
    forms.doctor!.weight = "bad";
    expect(parseLobbyForm("8", "weighted-random", forms, "").success).toBe(
      false,
    );
  });
});
