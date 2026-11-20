import { describe, it, expect } from "vitest";
import { initialRoleForms } from "@mernmafia/shared/game/lobbyConfig";
import { createCustomRoleDraft } from "@mernmafia/shared/game/customRoles";
import { syncCustomRoleForms, isUnauthorizedPresetError } from "./form-helpers";
describe("custom role form reconciliation", () => {
  it("preserves existing allocations, adds new roles and removes deleted roles", () => {
    const initial = initialRoleForms();
    initial.doctor!.enabled = true;
    const first = syncCustomRoleForms(initial, [createCustomRoleDraft()]);
    first["custom:field-medic"]!.minimum = "2";
    const edited = syncCustomRoleForms(first, [
      { ...createCustomRoleDraft(), name: "Renamed" },
    ]);
    expect(edited["custom:field-medic"]!.minimum).toBe("2");
    expect(edited.doctor!.enabled).toBe(true);
    const removed = syncCustomRoleForms(edited, []);
    expect(removed["custom:field-medic"]).toBeUndefined();
    expect(removed.doctor!.enabled).toBe(true);
    expect(first["custom:field-medic"]).toBeDefined();
  });
});
describe("imported custom role definitions", () => {
  it("keeps unselected definitions available without altering the roster", () => {
    const forms = syncCustomRoleForms(initialRoleForms(), [createCustomRoleDraft()], false);
    expect(forms["custom:field-medic"]?.enabled).toBe(false);
  });
});
describe("preset authentication errors", () => {
  it("distinguishes signed-out state from broken service errors", () => {
    expect(isUnauthorizedPresetError({ data: { code: "UNAUTHORIZED" } })).toBe(
      true,
    );
    for (const error of [
      null,
      "UNAUTHORIZED",
      new Error("offline"),
      { data: { code: "INTERNAL_SERVER_ERROR" } },
      { data: null },
    ])
      expect(isUnauthorizedPresetError(error)).toBe(false);
  });
});
