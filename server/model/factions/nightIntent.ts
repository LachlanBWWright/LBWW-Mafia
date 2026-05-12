import type { CombatLevel } from "../roles/combatLevel.js";
import type { Role } from "../roles/abstractRole.js";

export type FactionNightActionIntent =
  | {
      kind: "attack";
      actor: Role;
      target: Role;
      damage: CombatLevel;
    }
  | {
      kind: "forced-visit";
      actor: Role;
      target: Role;
    };
