import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { beforeEach, describe, expect, it } from "vitest";
import {
  assignRole,
  captureEmitter,
  createRoomWithPlayers,
  type EmittedCall,
} from "../../testUtils/gameTestUtils.js";
import { CombatLevel } from "../../roles/combatLevel.js";
import { doctorDefinition } from "../../roles/definitions/town.js";
import { CombatSystem } from "./combatSystem.js";

let emittedCalls: EmittedCall[];

beforeEach(() => {
  emittedCalls = captureEmitter();
});

describe("CombatSystem", () => {
  it("marks a player dead and emits death messages when damage exceeds defence", () => {
    const { room, players } = createRoomWithPlayers("combat-system-death", ["target"]);
    const targetPlayer = players[0]!;
    const target = assignRole(room, targetPlayer, doctorDefinition);
    target.damage = CombatLevel.High;

    const somebodyDied = new CombatSystem(room).resolveRoleDamage(target);

    expect(somebodyDied).toBe(true);
    expect(targetPlayer.isAlive).toBe(false);
    expect(target.damage).toBe(CombatLevel.None);
    expect(target.attackers).toEqual([]);
    expect(
      emittedCalls.some(
        (call) =>
          call.target === targetPlayer.user.socketId &&
          call.event === ServerEvent.ReceiveMessage &&
          (call.args[0] as { key?: MessageKey }).key === MessageKey.YouHaveDied,
      ),
    ).toBe(true);
  });

  it("resets temporary night state while preserving persistent role state", () => {
    const { room, players } = createRoomWithPlayers("combat-system-cleanup", [
      "doctor",
      "target",
    ]);
    const doctor = assignRole(room, players[0]!, doctorDefinition);
    const target = assignRole(room, players[1]!, doctorDefinition);
    doctor.visiting = target;
    doctor.dayVisiting = target;
    doctor.visitors = [target];
    doctor.attackers = [target];
    doctor.nightTappedBy = target;
    doctor.defence = CombatLevel.Low;
    doctor.damage = CombatLevel.Low;
    doctor.setPersistentCharge("test-charge", 2);

    const somebodyDied = new CombatSystem(room).resolveNightCleanup(2, 3);

    expect(somebodyDied).toBe(false);
    expect(doctor.visiting).toBeNull();
    expect(doctor.dayVisiting).toBeNull();
    expect(doctor.visitors).toEqual([]);
    expect(doctor.attackers).toEqual([]);
    expect(doctor.nightTappedBy).toBeNull();
    expect(doctor.damage).toBe(CombatLevel.None);
    expect(doctor.getPersistentCharge("test-charge")).toBe(2);
  });
});
