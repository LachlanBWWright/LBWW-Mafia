import type { CombatLevel } from "../roles/combatLevel.js";
import type { GameRole } from "../roles/roleContracts.js";

export type FactionNightActionIntent =
  | {
      kind: "attack";
      actor: GameRole;
      target: GameRole;
      damage: CombatLevel;
    }
  | {
      kind: "forced-visit";
      actor: GameRole;
      target: GameRole;
    };
