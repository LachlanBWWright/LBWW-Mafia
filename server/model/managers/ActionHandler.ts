import type { Player } from "../player/player.js";
import { Time } from "../../../shared/socketTypes/socketTypes.js";

/**
 * Action result from executing an action
 */
export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Action metadata for tracking
 */
export interface ActionMetadata {
  playerId: string;
  playerUsername: string;
  timestamp: number;
}

/**
 * Action type enumeration
 */
export enum ActionType {
  VOTE = "VOTE",
  WHISPER = "WHISPER",
  VISIT_DAY = "VISIT_DAY",
  VISIT_NIGHT = "VISIT_NIGHT",
  MESSAGE = "MESSAGE",
  CANCEL_DAY_ACTION = "CANCEL_DAY_ACTION",
  CANCEL_NIGHT_ACTION = "CANCEL_NIGHT_ACTION",
}

/**
 * Context provided to actions for validation and execution
 */
export interface GameContext {
  currentPhase: Time;
  getPlayer: (id: string) => Player | null;
  getPlayerByPosition: (position: number) => Player | null;
  getAllPlayers: () => readonly Player[];
  getAlivePlayers: () => Player[];
  confesserVotedOut: boolean;
}

/**
 * Base interface for game actions using Command pattern
 */
export interface GameAction {
  /**
   * Execute the action
   */
  execute(context: GameContext): ActionResult;

  /**
   * Validate if the action can be executed
   */
  validate(context: GameContext): boolean;

  /**
   * Get the action type
   */
  getType(): ActionType;

  /**
   * Get action metadata
   */
  getMetadata(): ActionMetadata;
}

/**
 * Abstract base class for actions
 */
export abstract class BaseAction implements GameAction {
  protected player: Player;
  protected timestamp: number;

  constructor(player: Player) {
    this.player = player;
    this.timestamp = Date.now();
  }

  abstract execute(context: GameContext): ActionResult;
  abstract validate(context: GameContext): boolean;
  abstract getType(): ActionType;

  getMetadata(): ActionMetadata {
    return {
      playerId: this.player.socketId,
      playerUsername: this.player.playerUsername,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Vote action
 */
export class VoteAction extends BaseAction {
  private targetPosition: number;

  constructor(player: Player, targetPosition: number) {
    super(player);
    this.targetPosition = targetPosition;
  }

  getType(): ActionType {
    return ActionType.VOTE;
  }

  validate(context: GameContext): boolean {
    const target = context.getPlayerByPosition(this.targetPosition);
    if (!target?.isAlive) return false;
    if (this.player === target) return false;
    if (this.player.hasVoted) return false;
    if (!this.player.isAlive) return false;
    return true;
  }

  execute(context: GameContext): ActionResult {
    if (!this.validate(context)) {
      return { success: false, error: "Invalid vote" };
    }

    const target = context.getPlayerByPosition(this.targetPosition);
    if (!target) {
      return { success: false, error: "Target not found" };
    }

    this.player.hasVoted = true;
    target.votesReceived++;

    return {
      success: true,
      message: `${this.player.playerUsername} voted for ${target.playerUsername}`,
    };
  }

  getTarget(): number {
    return this.targetPosition;
  }
}

/**
 * Whisper action
 */
export class WhisperAction extends BaseAction {
  private targetPosition: number;
  private message: string;

  constructor(player: Player, targetPosition: number, message: string) {
    super(player);
    this.targetPosition = targetPosition;
    this.message = message;
  }

  getType(): ActionType {
    return ActionType.WHISPER;
  }

  validate(context: GameContext): boolean {
    if (context.currentPhase !== Time.Day) return false;
    if (!context.getPlayerByPosition(this.targetPosition)?.isAlive)
      return false;
    if (!this.player.isAlive) return false;
    return true;
  }

  execute(context: GameContext): ActionResult {
    if (!this.validate(context)) {
      return { success: false, error: "Invalid whisper" };
    }

    return {
      success: true,
      message: `Whisper sent from ${this.player.playerUsername}`,
    };
  }

  getMessage(): string {
    return this.message;
  }

  getTarget(): number {
    return this.targetPosition;
  }
}

/**
 * Day visit action
 */
export class DayVisitAction extends BaseAction {
  private targetPosition: number | null;

  constructor(player: Player, targetPosition: number | null) {
    super(player);
    this.targetPosition = targetPosition;
  }

  getType(): ActionType {
    return this.targetPosition === null
      ? ActionType.CANCEL_DAY_ACTION
      : ActionType.VISIT_DAY;
  }

  validate(context: GameContext): boolean {
    if (context.currentPhase !== Time.Day) return false;
    if (!this.player.isAlive) return false;

    if (this.targetPosition !== null) {
      const target = context.getPlayerByPosition(this.targetPosition);
      if (!target) return false;
    }

    return true;
  }

  execute(context: GameContext): ActionResult {
    if (!this.validate(context)) {
      return { success: false, error: "Invalid day visit" };
    }

    if (this.targetPosition === null) {
      this.player.role.cancelDayAction();
    } else {
      const target = context.getPlayerByPosition(this.targetPosition);
      if (target) {
        this.player.role.handleDayAction(target);
      }
    }

    return { success: true };
  }

  getTarget(): number | null {
    return this.targetPosition;
  }
}

/**
 * Night visit action
 */
export class NightVisitAction extends BaseAction {
  private targetPosition: number | null;

  constructor(player: Player, targetPosition: number | null) {
    super(player);
    this.targetPosition = targetPosition;
  }

  getType(): ActionType {
    return this.targetPosition === null
      ? ActionType.CANCEL_NIGHT_ACTION
      : ActionType.VISIT_NIGHT;
  }

  validate(context: GameContext): boolean {
    if (context.currentPhase !== Time.Night) return false;
    if (!this.player.isAlive) return false;
    if (this.player.role.roleblocked) return false;

    if (this.targetPosition !== null) {
      const target = context.getPlayerByPosition(this.targetPosition);
      if (!target) return false;
    }

    return true;
  }

  execute(context: GameContext): ActionResult {
    if (!this.validate(context)) {
      if (this.player.role.roleblocked) {
        return { success: false, error: "You are roleblocked" };
      }
      return { success: false, error: "Invalid night visit" };
    }

    if (this.targetPosition === null) {
      this.player.role.cancelNightAction();
    } else {
      const target = context.getPlayerByPosition(this.targetPosition);
      if (target) {
        this.player.role.handleNightAction(target);
      }
    }

    return { success: true };
  }

  getTarget(): number | null {
    return this.targetPosition;
  }
}

/**
 * Action handler using Command pattern for unified action processing
 */
export class ActionHandler {
  private actionHistory: GameAction[] = [];
  private maxHistorySize = 1000;

  /**
   * Execute an action
   */
  executeAction(action: GameAction, context: GameContext): ActionResult {
    const result = action.execute(context);

    // Add to history if successful
    if (result.success) {
      this.actionHistory.push(action);
      if (this.actionHistory.length > this.maxHistorySize) {
        this.actionHistory.shift();
      }
    }

    return result;
  }

  /**
   * Check if an action can be executed
   */
  canExecute(action: GameAction, context: GameContext): boolean {
    return action.validate(context);
  }

  /**
   * Get action history
   */
  getHistory(): readonly GameAction[] {
    return [...this.actionHistory];
  }

  /**
   * Get actions by type
   */
  getHistoryByType(type: ActionType): GameAction[] {
    return this.actionHistory.filter((action) => action.getType() === type);
  }

  /**
   * Get actions by player
   */
  getHistoryByPlayer(playerId: string): GameAction[] {
    return this.actionHistory.filter(
      (action) => action.getMetadata().playerId === playerId,
    );
  }

  /**
   * Clear action history
   */
  clearHistory(): void {
    this.actionHistory = [];
  }

  /**
   * Set maximum history size
   */
  setMaxHistorySize(size: number): void {
    this.maxHistorySize = size;
    while (this.actionHistory.length > size) {
      this.actionHistory.shift();
    }
  }
}
