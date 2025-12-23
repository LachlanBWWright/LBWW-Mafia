import { RoleGroup } from "../../../shared/roles/roleEnums.js";
import type { Player } from "../player/player.js";
import type { Framer } from "../roles/neutral/framer.js";
import type { Confesser } from "../roles/neutral/confesser.js";
import type { Peacemaker } from "../roles/neutral/peacemaker.js";

/**
 * Result of a win condition check
 */
export interface WinResult {
  winningFaction: string;
  winningPlayers: Player[];
  specialWins?: {
    framer?: boolean;
    confesser?: boolean;
    peacemaker?: boolean;
  };
}

/**
 * Context for checking win conditions
 */
export interface WinConditionContext {
  alivePlayers: Player[];
  allPlayers: Player[];
  dayNumber: number;
  endDay: number;
  confesserVotedOut: boolean;
  framer?: Framer | null;
  confesser?: Confesser;
  peacemaker?: Peacemaker | null;
}

/**
 * Interface for win conditions
 */
export interface WinCondition {
  /**
   * Check if this win condition is met
   * @returns WinResult if condition is met, null otherwise
   */
  check(context: WinConditionContext): WinResult | null;

  /**
   * Get the priority of this win condition (higher = checked first)
   */
  getPriority(): number;

  /**
   * Get the name/description of this win condition
   */
  getName(): string;
}

/**
 * Win condition: Peacemaker wins if nobody dies for 3 consecutive days
 */
export class PeacemakerWinCondition implements WinCondition {
  getPriority(): number {
    return 100; // Highest priority
  }

  getName(): string {
    return "Peacemaker Draw";
  }

  check(context: WinConditionContext): WinResult | null {
    if (context.endDay <= context.dayNumber && context.peacemaker) {
      return {
        winningFaction: "nobody",
        winningPlayers: [context.peacemaker.player],
        specialWins: {
          peacemaker: true,
        },
      };
    }
    return null;
  }
}

/**
 * Win condition: Maximum days reached
 */
export class MaxDaysWinCondition implements WinCondition {
  private maxDays: number;

  constructor(maxDays: number) {
    this.maxDays = maxDays;
  }

  getPriority(): number {
    return 90;
  }

  getName(): string {
    return "Maximum Days Reached";
  }

  check(context: WinConditionContext): WinResult | null {
    if (context.dayNumber >= this.maxDays) {
      return {
        winningFaction: "nobody",
        winningPlayers: [],
      };
    }
    return null;
  }
}

/**
 * Win condition: Faction elimination (one faction remains)
 */
export class FactionEliminationWinCondition implements WinCondition {
  getPriority(): number {
    return 50; // Lower priority than special conditions
  }

  getName(): string {
    return "Faction Elimination";
  }

  check(context: WinConditionContext): WinResult | null {
    let lastFaction: RoleGroup | "neutral" = "neutral";
    const winningPlayers: Player[] = [];

    for (const player of context.alivePlayers) {
      // Neutral roles that can win with anyone are excluded from faction checks
      if (player.role.group !== RoleGroup.Neutral) {
        if (lastFaction === "neutral") {
          lastFaction = player.role.group;
        } else if (player.role.group !== lastFaction) {
          // Multiple factions still alive
          return null;
        }
      }
    }

    // If we get here, only one faction (or all neutral) remains
    if (lastFaction !== "neutral") {
      // A specific faction won
      for (const player of context.alivePlayers) {
        if (
          player.role.group === lastFaction ||
          player.role.group === RoleGroup.Neutral
        ) {
          winningPlayers.push(player);
        }
      }

      return {
        winningFaction: lastFaction,
        winningPlayers,
      };
    } else {
      // All remaining are neutral
      return {
        winningFaction: "neutral",
        winningPlayers: context.alivePlayers,
      };
    }
  }
}

/**
 * Manager for checking and registering win conditions
 */
export class WinConditionManager {
  private conditions: WinCondition[] = [];

  /**
   * Register a win condition
   */
  registerCondition(condition: WinCondition): void {
    this.conditions.push(condition);
    // Sort by priority (highest first)
    this.conditions.sort((a, b) => b.getPriority() - a.getPriority());
  }

  /**
   * Check all win conditions and return the first one that is met
   */
  checkWinConditions(context: WinConditionContext): WinResult | null {
    for (const condition of this.conditions) {
      const result = condition.check(context);
      if (result !== null) {
        return result;
      }
    }
    return null;
  }

  /**
   * Remove all registered conditions
   */
  clearConditions(): void {
    this.conditions = [];
  }

  /**
   * Get all registered conditions
   */
  getConditions(): readonly WinCondition[] {
    return [...this.conditions];
  }
}
