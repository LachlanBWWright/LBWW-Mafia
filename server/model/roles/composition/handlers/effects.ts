import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { GameRole } from "../../roleContracts.js";
import type { RoleInstance } from "../roleInstance.js";
import type { RoleHandlerInput } from "./types.js";
import { accepted } from "./results.js";

export function applyDefenceMinimum(role: GameRole, level: CombatLevel): void {
  if (role.defence < level) {
    role.defence = level;
  }
}

export function applyDamageMinimum(role: GameRole, level: CombatLevel): void {
  if (role.damage < level) {
    role.damage = level;
  }
}

/**
 * Registers a visit on the chosen night target.
 *
 * @param role - Visiting role.
 * @returns Visited role if one exists.
 */
export function registerNightVisit(role: RoleInstance): GameRole | null {
  const target = role.visiting;
  if (!target) {
    return null;
  }
  target.receiveVisit(role);
  return target;
}

/**
 * Registers a visit on the chosen day target.
 *
 * @param role - Visiting role.
 * @returns Visited role if one exists.
 */
export function registerDayVisit(role: RoleInstance): GameRole | null {
  const target = role.dayVisiting;
  if (!target) {
    return null;
  }
  target.receiveVisit(role);
  return target;
}

/**
 * Records an attacker on a target.
 *
 * @param target - Target that is being attacked.
 * @param attacker - Role dealing the attack.
 */
export function addAttacker(target: GameRole, attacker: GameRole): void {
  target.attackers.push(attacker);
}

/**
 * Applies roleblock state to a target.
 *
 * @param target - Target to block.
 * @param actor - Optional source role.
 */
export function roleblockTarget(
  target: GameRole,
  actor?: GameRole,
): void {
  target.roleblocked = true;
  target.roleblocking = actor ?? null;
}

/**
 * Chooses the current day target.
 *
 * @param role - Role making the choice.
 * @param target - Selected target.
 */
export function chooseDayTarget(role: RoleInstance, target: GameRole): void {
  role.dayVisiting = target;
}

/**
 * Chooses the current night target.
 *
 * @param role - Role making the choice.
 * @param target - Selected target.
 */
export function chooseNightTarget(
  role: RoleInstance,
  target: GameRole,
): void {
  role.visiting = target;
}

/**
 * Toggles a self-targeting night action.
 *
 * @param role - Acting role.
 * @returns Accepted result.
 */
export function toggleNightSelfTarget(role: RoleInstance) {
  role.visiting = role.visiting === role ? null : role;
  return accepted;
}

/**
 * Creates a simple attack handler.
 *
 * @param level - Minimum damage applied to the target.
 * @returns Reusable role handler.
 */
export function simpleAttack(level: CombatLevel): RoleHandlerInput {
  return {
    onNightVisit: [({ role }) => {
      const target = registerNightVisit(role);
      if (!target) return;
      applyDamageMinimum(target, level);
      addAttacker(target, role);
    }],
  };
}

/**
 * Creates a roleblock visit handler.
 *
 * @param townAlways - Whether the block always succeeds on town or everyone.
 * @returns Reusable role handler.
 */
export function roleblockVisit(townAlways = true): RoleHandlerInput {
  return {
    onNightVisit: [({ role }) => {
      const target = role.visiting;
      if (!target) return;
      if (townAlways || target.group === RoleGroup.Town || role.room.random() > 0.5) {
        target.receiveVisit(role);
        roleblockTarget(target, role);
      }
    }],
  };
}
