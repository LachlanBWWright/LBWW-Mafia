import { Role } from "../abstractRole.js";
import { Room } from "../../rooms/room.js";
import { Player } from "../../player/player.js";
import { GamePhase } from "../../rooms/gamePhase.js";
import { DayTime } from "@mernmafia/shared/communication/events";
import { CombatLevel } from "../combatLevel.js";

/**
 * Validation error result from action handler validation.
 */
export type ValidationError = {
  code: string;
  message: string;
};

/**
 * Context passed to action handlers during action execution.
 */
export type ActionContext = {
  actor: Role;
  target: Player | null;
  phase: GamePhase;
  time: DayTime;
  room: Room;
};

/**
 * Extended context passed to apply handler when action is finalized.
 */
export type ApplyContext = ActionContext & {
  targetRole: Role;
};

/**
 * Metadata describing a role's static properties.
 */
export type RoleMetadata = {
  name: string;
  faction: "town" | "mafia" | "neutral";
  category: string;
  summary: string;
  description: string;
  powerValue: number;
  isUnique: boolean;
  capabilities: {
    dayVisitSelf: boolean;
    dayVisitOthers: boolean;
    dayVisitFaction: boolean;
    nightVisitSelf: boolean;
    nightVisitOthers: boolean;
    nightVisitFaction: boolean;
  };
};

/**
 * Effect configuration for custom roles.
 */
export type RoleEffects = {
  heal?: {
    defenseLevel: CombatLevel;
  };
  damage?: {
    level: CombatLevel;
  };
  investigate?: {
    type: "role" | "faction" | "alignment";
    accuracyPercent: number;
  };
};

/**
 * Definition of a custom role that can be composed from handlers.
 */
export type CustomRoleDefinition = {
  id?: number;
  metadata: RoleMetadata;
  effects?: RoleEffects;
  customHandlerClass?: new () => ActionHandler;
  creatorId?: string;
  isPublished?: boolean;
};

/**
 * Interface for composable action handlers.
 * Handlers define specific behaviors that can be attached to roles.
 */
export interface ActionHandler {
  /**
   * Called when this handler is attached to a role.
   * Use to initialize and modify role capabilities.
   */
  attach?(role: Role): void;

  /**
   * Validates if an action can be performed.
   * Returns array of validation errors (empty = valid).
   */
  validate?(context: ActionContext): ValidationError[];

  /**
   * Executes the action. Called after validation passes.
   * Sets up the targeting/action state.
   */
  execute?(context: ActionContext): void;

  /**
   * Applies the action effect. Called when the action is finalized.
   * Modifies game state based on the action.
   */
  apply?(context: ApplyContext): void;

  /**
   * Cleanup called at end of phase. Clears temporary state.
   */
  cleanup?(phase: GamePhase): void;
}
