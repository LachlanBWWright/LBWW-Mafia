import { CombatLevel } from "../../combatLevel.js";
import type { ComposedRole } from "../composedRole.js";

export function applyDefenceMinimum(role: ComposedRole, level: CombatLevel): void {
  if (role.defence < level) {
    role.defence = level;
  }
}

export function applyDamageMinimum(role: ComposedRole, level: CombatLevel): void {
  if (role.damage < level) {
    role.damage = level;
  }
}
