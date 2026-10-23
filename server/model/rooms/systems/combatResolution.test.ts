import { describe, expect, it } from "vitest";
import {
  assignRole,
  createRoomWithPlayers,
  installNoopEmitter,
} from "../../testUtils/gameTestUtils.js";
import { CombatLevel } from "../../roles/combatLevel.js";
import { doctorDefinition } from "../../roles/definitions/town.js";
import { resolveDamageOutcome } from "./combatResolution.js";

describe("resolveDamageOutcome", () => {
  it("returns no damage when no attack was applied", () => {
    installNoopEmitter();
    const { room, players } = createRoomWithPlayers("combat-none", ["target"]);
    const target = assignRole(room, players[0]!, doctorDefinition);

    expect(resolveDamageOutcome(target)).toEqual({ kind: "no-damage" });
  });

  it("returns survived when damage does not exceed effective defence", () => {
    installNoopEmitter();
    const { room, players } = createRoomWithPlayers("combat-survive", ["target"]);
    const target = assignRole(room, players[0]!, doctorDefinition);
    target.damage = CombatLevel.Low;
    target.defence = CombatLevel.Low;

    expect(resolveDamageOutcome(target)).toEqual({ kind: "survived" });
  });

  it("returns died when damage exceeds effective defence", () => {
    installNoopEmitter();
    const { room, players } = createRoomWithPlayers("combat-died", ["target"]);
    const target = assignRole(room, players[0]!, doctorDefinition);
    target.damage = CombatLevel.High;
    target.defence = CombatLevel.Low;

    expect(resolveDamageOutcome(target)).toEqual({ kind: "died" });
  });
});
