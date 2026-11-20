import { describe, expect, it } from "vitest";
import { createCustomRoleDraft } from "@mernmafia/shared/game/customRoles";
import { runRoleSandbox } from "./roleSandbox.js";
import { setGameEmitter } from "../../../servers/emitter.js";

describe("isolated custom role sandbox", () => {
  it("executes finite charges and cooldowns over real lifecycle cleanup", () => {
    const result = runRoleSandbox({ role: { ...createCustomRoleDraft(), noRepeatTarget: false, charges: 2, cooldownNights: 1 }, nights: 5, incomingAttack: true });
    expect(result.nights.map(night => night.accepted)).toEqual([true, false, true, false, false]);
    expect(result.nights[0]).toMatchObject({ targetDamage: 1, targetDefence: 1 });
    expect(result.nights[1]?.targetDefence).toBe(0);
  });
  it("keeps investigative results in the sandbox emitter and honours accuracy", () => {
    const escaped: unknown[] = [];
    setGameEmitter({ to: () => ({ emit: (...args) => { escaped.push(args); } }), in: () => ({ disconnectSockets() {} }) });
    const role = { ...createCustomRoleDraft(), effect: "investigate", noRepeatTarget: false, investigationAccuracy: 100 };
    expect(runRoleSandbox({ role, nights: 1 }).nights[0]?.notices).toContain("Investigation: mafia");
    expect(runRoleSandbox({ role: { ...role, investigationAccuracy: 0 }, nights: 1 }).nights[0]?.notices).toContain("Investigation: town");
    expect(escaped).toEqual([]);
  });
  it("runs target attacks through real block and redirect visit ordering", () => {
    const ordinary = runRoleSandbox({ role: { ...createCustomRoleDraft(), effect: "investigate" }, nights: 1 }).nights[0]!;
    expect(ordinary.notices).toContain("Other died.");
    const blocked = runRoleSandbox({ role: { ...createCustomRoleDraft(), effect: "block" }, nights: 1 }).nights[0]!;
    expect(blocked.targetBlocked).toBe(true);
    expect(blocked.notices).not.toContain("Other died.");
    const redirected = runRoleSandbox({ role: { ...createCustomRoleDraft(), effect: "redirect" }, nights: 1 }).nights[0]!;
    expect(redirected.redirectedToActor).toBe(true);
    expect(redirected.notices).toContain("Actor died.");
    expect(redirected.notices).not.toContain("Other died.");
  });
  it("uses actual combat to distinguish protection from an exhausted charge", () => {
    const result = runRoleSandbox({ role: { ...createCustomRoleDraft(), charges: 1, noRepeatTarget: false }, nights: 3, incomingAttack: true });
    expect(result.nights[0]?.notices).toContain("Target survived the incoming attack.");
    for (const night of result.nights.slice(1)) {
      expect(night.accepted).toBe(false);
      expect(night.notices).toContain("Target died.");
      expect(night.notices).toContain("Other died.");
    }
  });
  it.each([false, true])("matches the default editor scenario after a skipped night (incoming attack: %s)", incomingAttack => {
    const result = runRoleSandbox({ role: createCustomRoleDraft(), nights: 3, incomingAttack });
    expect(result.nights.map(night => night.accepted)).toEqual([true, false, true]);
    expect(result.nights.map(night => night.targetDefence)).toEqual([1, 0, 1]);
    expect(result.nights.every(night => night.notices.includes("Other died."))).toBe(true);
  });
  it("bounds scenarios and rejects executable input", () => {
    expect(() => runRoleSandbox({ role: createCustomRoleDraft(), nights: 100 })).toThrow();
    expect(() => runRoleSandbox({ role: { ...createCustomRoleDraft(), execute: "attackAll()" } })).toThrow();
  });
  it.each(["block", "redirect", "attack"])("reports actual %s effects", effect => {
    const result = runRoleSandbox({ role: { ...createCustomRoleDraft(), effect }, nights: 1 }).nights[0]!;
    expect(result.accepted).toBe(true);
    if (effect === "block") expect(result.targetBlocked).toBe(true);
    if (effect === "redirect") expect(result.redirectedToActor).toBe(true);
    if (effect === "attack") expect(result.targetDamage).toBe(1);
  });
});
