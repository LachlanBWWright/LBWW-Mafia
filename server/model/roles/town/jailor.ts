import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { GamePhase } from "../../rooms/gamePhase.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that can jail a player during the day, preventing their actions.
 * Can then choose to execute the jailed player at night.
 * Jailed players and the Jailor can communicate privately during the night.
 * 
 * @class Jailor
 * @extends {Role}
 */
export class Jailor extends Role {
  name = "Jailor";
  group = RoleGroup.Town;
  baseDefence = 0;
  defence = 0;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = true;
  dayVisitFaction = false;
  nightVisitSelf = true;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Jailor instance.
   * 
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles chat messages. If a player is jailed, messages are only visible to them and the Jailor.
   * Otherwise, uses standard message handling.
   * 
   * @param {string} message - The chat message
   * @returns {void}
   */
  handleMessage(message: string) {
    const socketId = this.player.user.socketId;
    if (this.room.time === GamePhase.Day) {
      super.handleMessage(message);
    } else if (this.dayVisiting != null) {
      io.to(socketId).emit(ServerEvent.ReceiveChatMessage, `Jailor: ${message}`);
      io.to(this.dayVisiting.player.user.socketId).emit(
        ServerEvent.ReceiveChatMessage,
        `Jailor: ${message}`,
      );
    } else {
      super.handleMessage(message);
    }
  }

  /**
   * Handles the day action to jail a player.
   * Validates that the target is not self and is alive.
   * 
   * @param {Player} recipient - The target player to jail
   * @returns {void}
   */
  handleDayAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot jail yourself.",
      );
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to jail " + recipient.username + ".",
      );
      this.dayVisiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Invalid choice.");
    }
  }

  /**
   * Handles the night action to decide whether to execute the jailed player.
   * Can toggle between execute and release decisions.
   * 
   * @param {Player} _recipient - Not used; affects the jailed player from dayVisiting
   * @returns {void}
   */
  handleNightAction(_recipient: Player) {
    if (this.dayVisiting == null) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You haven't jailed anyone, so you cannot do anything.",
      );
    } else {
      if (this.visiting == null) {
        this.visiting = this.dayVisiting;
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "You have decided to execute the prisoner.",
        );
        io.to(this.dayVisiting.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "The jailor has decided to execute you",
        );
      } else {
        this.visiting = null;
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "You have decided not to execute the prisoner.",
        );
        io.to(this.dayVisiting.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "The jailor has decided not to execute you",
        );
      }
    }
  }

  /**
   * Processes the day action of jailing a player.
   * Notifies the player they've been jailed and applies roleblock.
   * 
   * @returns {void}
   */
  dayVisit() {
    if (this.dayVisiting != null) {
      io.to(this.dayVisiting.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have been jailed!",
      );
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have jailed your target.",
      );
      this.dayVisiting.jailed = this;
      this.dayVisiting.roleblocked = true;
    }
  }

  /**
   * Processes the execution of the jailed player.
   * Inflicts 3 damage to execute the prisoner.
   * 
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      if (this.visiting.damage < 3) this.visiting.damage = 3;
      this.visiting.attackers.push(this);
    }
  }

  /**
   * Processes post-visit effects. Resets jail status and provides defense to the jailed player.
   * If jailed player wasn't executed, increases their defense.
   * 
   * @returns {void}
   */
  handleVisits() {
    if (this.dayVisiting != null) this.dayVisiting.jailed = null;
    if (this.dayVisiting != null) {
      if (this.dayVisiting.baseDefence == 0) this.dayVisiting.defence = 1;
    }
  }
}
