import { CombatLevel } from "../combatLevel.js";
import type { Role } from "../abstractRole.js";

/**
 * Explicit per-role runtime state used by composed handlers.
 * Legacy mutable fields on RoleInstance are synchronized against this state.
 */
export type RoleFactionAction =
  | { kind: "attack"; damage: CombatLevel }
  | { kind: "forced-visit" };

export type RoleRuntimeState = {
  persistent: {
    charges: Record<string, number>;
    targets: Record<string, Role | null>;
    flags: Record<string, boolean>;
  };
  dayAction: {
    target: Role | null;
  };
  nightAction: {
    target: Role | null;
    factionVoteTarget: Role | null;
    factionAction: RoleFactionAction | null;
  };
  combat: {
    defence: CombatLevel;
    damage: CombatLevel;
    attackers: Role[];
    visitors: Role[];
  };
  statuses: {
    roleblocking: Role | null;
    roleblocked: boolean;
    silenced: boolean;
    dayTappedBy: Role | null;
    nightTappedBy: Role | null;
    jailedBy: Role | null;
  };
  compatibility: {
    isAttacking: boolean;
    isInsane: boolean;
    victoryCondition: boolean;
  };
};

/**
 * Creates an empty runtime state object for a role.
 *
 * @param baseDefence - The role's baseline defence value.
 * @returns Newly initialized runtime state.
 */
export function createRoleRuntimeState(baseDefence: CombatLevel): RoleRuntimeState {
  return {
    persistent: {
      charges: {},
      targets: {},
      flags: {},
    },
    dayAction: {
      target: null,
    },
    nightAction: {
      target: null,
      factionVoteTarget: null,
      factionAction: null,
    },
    combat: {
      defence: baseDefence,
      damage: CombatLevel.None,
      attackers: [],
      visitors: [],
    },
    statuses: {
      roleblocking: null,
      roleblocked: false,
      silenced: false,
      dayTappedBy: null,
      nightTappedBy: null,
      jailedBy: null,
    },
    compatibility: {
      isAttacking: false,
      isInsane: false,
      victoryCondition: false,
    },
  };
}

/**
 * Clears day-scoped runtime state.
 *
 * @param state - State to mutate.
 */
export function resetDayActionState(state: RoleRuntimeState): void {
  state.dayAction.target = null;
  state.statuses.dayTappedBy = null;
}

/**
 * Clears night-scoped runtime state.
 *
 * @param state - State to mutate.
 * @param baseDefence - Defence to restore after cleanup.
 */
export function resetNightActionState(
  state: RoleRuntimeState,
  baseDefence: CombatLevel,
): void {
  state.dayAction.target = null;
  state.nightAction.target = null;
  state.nightAction.factionVoteTarget = null;
  state.nightAction.factionAction = null;
  state.combat.defence = baseDefence;
  state.combat.damage = CombatLevel.None;
  state.combat.attackers = [];
  state.combat.visitors = [];
  state.statuses.roleblocked = false;
  state.statuses.roleblocking = null;
  state.statuses.nightTappedBy = null;
  state.statuses.jailedBy = null;
  state.compatibility.isAttacking = false;
}
