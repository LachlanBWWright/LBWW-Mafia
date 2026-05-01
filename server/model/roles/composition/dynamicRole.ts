import { Role } from "../abstractRole.js";
import { Room } from "../../rooms/room.js";
import { Player } from "../../player/player.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { GamePhase } from "../../rooms/gamePhase.js";
import { DayTime } from "@mernmafia/shared/communication/events";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";
import {
  ActionHandler,
  ActionContext,
  ApplyContext,
  RoleMetadata,
} from "./types.js";

/**
 * A dynamic role that composes behavior from reusable action handlers.
 * Used for custom user-created roles without modifying the built-in role hierarchy.
 *
 * This role class is instantiated for each custom role definition and uses
 * ActionHandlers to define its specific behaviors.
 */

export class DynamicRole extends Role {
  readonly metadata: RoleMetadata;
  private handlers: ActionHandler[] = [];

  /**
   * Creates a new DynamicRole with composed handlers.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   * @param {RoleMetadata} metadata - The role's metadata
   * @param {ActionHandler[]} handlers - Composed action handlers
   */
  constructor(
    room: Room,
    player: Player,
    metadata: RoleMetadata,
    handlers: ActionHandler[],
  ) {
    super(room, player);

    this.metadata = metadata;
    this.handlers = handlers;
    this.name = metadata.name;

    // Convert faction string to RoleGroup
    const factionMap: Record<string, RoleGroup> = {
      town: RoleGroup.Town,
      mafia: RoleGroup.Mafia,
      neutral: RoleGroup.Neutral,
    };
    this.group = factionMap[metadata.faction] ?? RoleGroup.Unaligned;

    this.baseDefence = CombatLevel.None;
    this.roleblocker = false;

    // Initialize all capabilities to false (handlers will enable as needed)
    this.dayVisitSelf = false;
    this.dayVisitOthers = false;
    this.dayVisitFaction = false;
    this.nightVisitSelf = false;
    this.nightVisitOthers = false;
    this.nightVisitFaction = false;
    this.nightVote = false;

    // Attach handlers to customize capabilities
    this.handlers.forEach((handler) => handler.attach?.(this));
  }

  /**
   * Initializes the role at game start.
   * Ensures all handlers are properly attached.
   */
  override initRole() {
    this.handlers.forEach((handler) => handler.attach?.(this));
  }

  /**
   * Handles a daytime action on a target player.
   * Validates and executes all handlers in sequence.
   *
   * @param {Player} recipient - The target player
   */
  override handleDayAction(recipient: Player) {
    const context: ActionContext = {
      actor: this,
      target: recipient,
      phase: GamePhase.Day,
      time: DayTime.Day,
      room: this.room,
    };

    // Validate all handlers
    for (const handler of this.handlers) {
      const errors = handler.validate?.(context) ?? [];
      if (errors.length > 0) {
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          errors[0].message,
        );
        return;
      }
    }

    // Execute all handlers
    for (const handler of this.handlers) {
      handler.execute?.(context);
    }
  }

  /**
   * Handles a nighttime action on a target player.
   * Validates and executes all handlers in sequence.
   *
   * @param {Player} recipient - The target player
   */
  override handleNightAction(recipient: Player) {
    const context: ActionContext = {
      actor: this,
      target: recipient,
      phase: GamePhase.Night,
      time: DayTime.Night,
      room: this.room,
    };

    // Validate all handlers
    for (const handler of this.handlers) {
      const errors = handler.validate?.(context) ?? [];
      if (errors.length > 0) {
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          errors[0].message,
        );
        return;
      }
    }

    // Execute all handlers
    for (const handler of this.handlers) {
      handler.execute?.(context);
    }
  }

  /**
   * Processes the visit action by applying all handler effects.
   * Called when the visit is finalized at the end of a phase.
   */
  override visit() {
    if (this.visiting == null) return;

    const context: ApplyContext = {
      actor: this,
      target: this.visiting.player,
      targetRole: this.visiting,
      phase: this.room.time,
      time: this.room.time === GamePhase.Day ? DayTime.Day : DayTime.Night,
      room: this.room,
    };

    // Apply all handler effects
    for (const handler of this.handlers) {
      handler.apply?.(context);
    }
  }

  /**
   * Cleanup called at end of phase.
   *
   * @param {GamePhase} phase - The phase that just ended
   */
  dayUpdate() {
    this.handlers.forEach((handler) => handler.cleanup?.(this.room.time));
  }
}
