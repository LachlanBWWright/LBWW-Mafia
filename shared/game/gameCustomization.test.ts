import { describe, expect, it } from "vitest";
import {
  lobbyConfigSchema,
  parseLobbyForm,
  selectLobbyRoles,
} from "./lobbyConfig";
import { lobbyPresetForm } from "./lobbyPresetForm";
import {
  cloneGameSetup,
  createGamePack,
  decodeGamePack,
  encodeGamePack,
  exportGamePack,
  freezeGameSetup,
  getSetupWarnings,
  importGamePack,
  resolveGameRules,
  summarizeGameSetup,
} from "./gameCustomization";
const setup = () =>
  lobbyConfigSchema.parse({
    size: 4,
    roleSelection: {
      algorithm: "weighted-random",
      roles: [{ role: "doctor" }, { role: "mafia", minimum: 1 }],
    },
  });
describe("versioned portable setups", () => {
  it("preserves legacy size-based pace while new explicit rules use the configured defaults", () => {
    expect(resolveGameRules({ size: 4 }).timing.daySeconds).toBe(26);
    expect(resolveGameRules({ size: 64 }).timing.daySeconds).toBe(266);
    expect(resolveGameRules({ size: 4, rules: {} }).timing.daySeconds).toBe(60);
    expect(resolveGameRules({ size: 4, rules: { timing: { daySeconds: 90 } } }).timing.daySeconds).toBe(90);
  });
  it("round trips unicode names, rules and custom roles through JSON and links", () => {
    const config = lobbyConfigSchema.parse({
      ...setup(),
      rules: {
        timing: { daySeconds: 120 },
        communication: { whispers: false },
      },
      customRoles: [
        {
          id: "medic",
          name: "Field Medic",
          effect: "protect",
          alignment: "town",
        },
      ],
      roleSelection: {
        algorithm: "explicit-slots",
        explicitSlots: ["custom:medic", "doctor", "doctor", "mafia"],
      },
    });
    const pack = createGamePack("Médic night 🩺", config);
    expect(importGamePack(exportGamePack(pack))).toEqual(pack);
    expect(decodeGamePack(encodeGamePack(pack))).toEqual(pack);
    const form = lobbyPresetForm(config);
    expect(
      parseLobbyForm(
        form.size,
        form.algorithm,
        form.roles,
        form.slots,
        form.customization,
      ),
    ).toEqual({ success: true, data: config });
    expect(selectLobbyRoles(config)).toEqual(
      config.roleSelection.explicitSlots,
    );
  });
  it("rejects malformed, oversized, unknown version and extra executable fields", () => {
    expect(() => importGamePack("oops")).toThrow("valid JSON");
    expect(() => importGamePack(" ".repeat(100001))).toThrow("100 KB");
    expect(() => decodeGamePack("x".repeat(300001))).toThrow("too large");
    expect(() => decodeGamePack("%zz")).toThrow();
    const pack = createGamePack("Evening", setup());
    for (const value of [
      { ...pack, version: 0 },
      { ...pack, version: 2 },
      { ...pack, format: "other" },
      { ...pack, script: "run()" },
      { ...pack, name: " " },
    ])
      expect(() => importGamePack(JSON.stringify(value))).toThrow();
  });
  it("preserves old setups without adding configured timing", () => {
    const config = setup();
    expect(config.rules).toBeUndefined();
    expect(
      importGamePack(exportGamePack(createGamePack("Classic", config))).config,
    ).toEqual(config);
    expect(resolveGameRules(config).timing.daySeconds).toBe(26);
  });
  it("clones and freezes nested arrays so presets cannot change running setups", () => {
    const config = setup(),
      frozen = freezeGameSetup(config),
      clone = cloneGameSetup(config);
    config.roleSelection.roles[0]!.weight = 8;
    expect(frozen.roleSelection.roles[0]!.weight).toBe(1);
    expect(clone.roleSelection.roles[0]!.weight).toBe(1);
    expect(Object.isFrozen(frozen.roleSelection.roles)).toBe(true);
    expect(() => {
      frozen.roleSelection.roles.push(frozen.roleSelection.roles[0]!);
    }).toThrow();
  });
});
describe("setup validation and summaries", () => {
  it("resolves partial options without mutating shared defaults", () => {
    expect(
      resolveGameRules({ rules: { timing: { daySeconds: 90 } } }).timing,
    ).toEqual({
      daySeconds: 90,
      nightSeconds: 15,
      firstDaySeconds: 5,
      earlyEnd: false,
    });
    expect(resolveGameRules({}).timing.daySeconds).toBe(60);
  });
  it("rejects unsafe timers, message limits, unknown settings and missing custom definitions", () => {
    for (const rules of [
      { timing: { daySeconds: 0 } },
      { communication: { messageLimit: -1 } },
      { voting: { tie: "first" } },
      { surprise: true },
    ])
      expect(lobbyConfigSchema.safeParse({ ...setup(), rules }).success).toBe(
        false,
      );
    expect(
      lobbyConfigSchema.safeParse({
        ...setup(),
        roleSelection: {
          algorithm: "explicit-slots",
          explicitSlots: Array(4).fill("custom:missing"),
        },
      }).success,
    ).toBe(false);
    const role = {
      id: "medic",
      name: "Medic",
      effect: "protect",
      alignment: "town",
    };
    expect(
      lobbyConfigSchema.safeParse({ ...setup(), customRoles: [role, role] })
        .success,
    ).toBe(false);
    expect(lobbyConfigSchema.safeParse({ ...setup(), customRoles: [role, { ...role, id: "other-medic" }] }).success).toBe(false);
    expect(lobbyConfigSchema.safeParse({ ...setup(), customRoles: [{ ...role, name: "Doctor" }] }).success).toBe(false);
  });
  it("provides actionable caveats rather than numerical balance claims", () => {
    const config = lobbyConfigSchema.parse({
      ...setup(),
      rules: { reveal: { onDeath: "none" }, voting: { tie: "random" } },
      roleSelection: {
        algorithm: "weighted-random",
        roles: [{ role: "doctor" }],
      },
    });
    expect(getSetupWarnings(config)).toHaveLength(4);
    expect(summarizeGameSetup(config).join(" ")).toContain(
      "Death reveals: none",
    );
    expect(
      getSetupWarnings(setup()).some((warning) => warning.includes("No Mafia")),
    ).toBe(false);
  });
});
