import { CombatLevel } from "../combatLevel.js";
import type { GameRole } from "../roleContracts.js";

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
    targets: Record<string, GameRole | null>;
    flags: Record<string, boolean>;
  };
  dayAction: {
    target: GameRole | null;
  };
  nightAction: {
    target: GameRole | null;
    factionVoteTarget: GameRole | null;
    factionAction: RoleFactionAction | null;
    isAttacking: boolean;
  };
  combat: {
    defence: CombatLevel;
    damage: CombatLevel;
    attackers: GameRole[];
    visitors: GameRole[];
  };
  statuses: {
    roleblocking: GameRole | null;
    roleblocked: boolean;
    silenced: boolean;
    dayTappedBy: GameRole | null;
    nightTappedBy: GameRole | null;
    jailedBy: GameRole | null;
  };
  mentalState: {
    isInsane: boolean;
  };
  victory: {
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
      isAttacking: false,
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
    mentalState: {
      isInsane: false,
    },
    victory: {
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
  state.nightAction.isAttacking = false;
  state.combat.defence = baseDefence;
  state.combat.damage = CombatLevel.None;
  state.combat.attackers = [];
  state.combat.visitors = [];
  state.statuses.roleblocked = false;
  state.statuses.roleblocking = null;
  state.statuses.nightTappedBy = null;
  state.statuses.jailedBy = null;
}
