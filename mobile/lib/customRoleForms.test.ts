import { describe, expect, it } from "vitest";
import { reconcileCustomRoleForms } from "./customRoleForms";
import { createCustomRoleDraft } from "../../shared/game/customRoles";
import { initialRoleForms, parseLobbyForm } from "../../shared/game/lobbyConfig";
import { lobbyPresetForm } from "../../shared/game/lobbyPresetForm";
import { createGamePack, exportGamePack, importGamePack, resolveGameRules } from "../../shared/game/gameCustomization";
describe("mobile custom setup controls", () => {
  it("preserves existing selection weights and removes deleted custom role controls", () => {
    const current = initialRoleForms();
    current["custom:field-medic"] = { enabled: true, weight: "3", minimum: "1", maximum: "2", tier: "4" };
    current["custom:deleted"] = { ...current["custom:field-medic"] };
    const next = reconcileCustomRoleForms(current, [createCustomRoleDraft()]);
    expect(next["custom:field-medic"]).toEqual(current["custom:field-medic"]);
    expect(next["custom:deleted"]).toBeUndefined();
    expect(next.doctor).toEqual(current.doctor);
    expect(current["custom:deleted"]).toBeDefined();
  });
  it("round-trips a native-authored pack without dropping custom definitions or rules", () => {
    const role = createCustomRoleDraft();
    const controls = reconcileCustomRoleForms(initialRoleForms(), [role]);
    controls["custom:field-medic"]!.enabled = true;
    controls.mafia!.enabled = true;
    const rules = resolveGameRules({ rules: { timing: { daySeconds: 125 }, reveal: { onDeath: "none" }, bots: { fillEmptySeats: true } } });
    const parsed = parseLobbyForm("8", "weighted-random", controls, "", { rules, customRoles: [role], voteVisibility: "hidden" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw parsed.error;
    const imported = importGamePack(exportGamePack(createGamePack("Native night", parsed.data)));
    const restored = lobbyPresetForm(imported.config);
    expect(restored.roles["custom:field-medic"]?.enabled).toBe(true);
    expect(imported.config.customRoles).toEqual([role]);
    expect(resolveGameRules(imported.config)).toEqual(rules);
    expect(imported.config.voteVisibility).toBe("hidden");
  });
});
