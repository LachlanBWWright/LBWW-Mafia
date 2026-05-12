import type { Role } from "../abstractRole.js";
import type { Faction } from "../../factions/abstractFaction.js";
import { CombatLevel } from "../combatLevel.js";

export type RoleRuntimeState = {
  faction?: Faction;
  baseDefence: CombatLevel;
  defence: CombatLevel;
  damage: CombatLevel;
  dayVisiting: Role | null;
  visiting: Role | null;
  visitors: Role[];
  attackers: Role[];
  roleblocking: Role | null;
  attackVote: Role | null;
  flags: {
    roleblocked: boolean;
    roleblocker: boolean;
    silenced: boolean;
    isAttacking: boolean;
    isInsane: boolean;
    victoryCondition: boolean;
  };
  statusRefs: {
    dayTapped: Role | boolean;
    nightTapped: Role | boolean;
    jailed: Role | null;
  };
  custom: {
    vetter?: {
      researchSlots: number;
    };
    sniper?: {
      lastVisited: Role | null;
    };
    nimby?: {
      alertSlots: number;
    };
    framer?: {
      target: Role | null;
    };
    fortifier?: {
      canFortify: boolean;
      playerFortified: Role | null;
    };
  };
};
