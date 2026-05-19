import type { CombatRole } from "../../roles/roleContracts.js";
import { CombatLevel } from "../../roles/combatLevel.js";

export type DamageResolutionOutcome =
  | { kind: "no-damage" }
  | { kind: "survived" }
  | { kind: "died" };

export function resolveDamageOutcome(role: CombatRole): DamageResolutionOutcome {
  const effectiveDefence =
    role.defence < role.baseDefence ? role.baseDefence : role.defence;

  if (role.damage > effectiveDefence) {
    return { kind: "died" };
  }

  if (role.damage !== CombatLevel.None) {
    return { kind: "survived" };
  }

  return { kind: "no-damage" };
}
