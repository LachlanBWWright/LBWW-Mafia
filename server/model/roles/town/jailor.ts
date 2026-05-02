import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { GamePhase } from "../../rooms/gamePhase.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
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
  baseDefence = CombatLevel.None;
  defence = CombatLevel.None;
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
   * @param room - The game room
   * @param player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles chat messages. If a player is jailed, messages are only visible to them and the Jailor.
   * Otherwise, uses standard message handling.
   *
   * @param message - The chat message
   * @returns
   */
  handleMessage(message: string) {
    if (this.room.time === GamePhase.Day) {
      super.handleMessage(message);
      return;
    }

    if (this.dayVisiting === null) {
      super.handleMessage(message);
      return;
    }

    const socketId = this.player.user.socketId;
    io.to(socketId).emit(
      ServerEvent.ReceiveChatMessage,
      `Jailor: ${message}`,
    );
    io.to(this.dayVisiting.player.user.socketId).emit(
      ServerEvent.ReceiveChatMessage,
      `Jailor: ${message}`,
    );
  }

  /**
   * Handles the day action to jail a player.
   * Validates that the target is not self and is alive.
   *
   * @param recipient - The target player to jail
   * @returns
   */
  handleDayAction(recipient: Player) {
    if (recipient === this.player) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.JailorCannotJailSelf,
      });
      return;
    }

    if (recipient.username !== undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.JailorChoseToJail,
        params: { targetName: recipient.username },
      });
      this.dayVisiting = recipient.role;
      return;
    }

    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.InvalidChoice,
    });
  }

  /**
   * Handles the night action to decide whether to execute the jailed player.
   * Can toggle between execute and release decisions.
   *
   * @param _recipient - Not used; affects the jailed player from dayVisiting
   * @returns
   */
  handleNightAction(_recipient: Player) {
    if (this.dayVisiting === null) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.JailorNoJailed,
      });
      return;
    }

    if (this.visiting === null) {
      this.visiting = this.dayVisiting;
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.JailorDecidedToExecute,
      });
      io.to(this.dayVisiting.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        { key: MessageKey.JailedWillBeExecuted },
      );
    } else {
      this.visiting = null;
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.JailorDecidedNotToExecute,
      });
      io.to(this.dayVisiting.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        { key: MessageKey.JailedWillNotBeExecuted },
      );
    }
  }

  /**
   * Processes the day action of jailing a player.
   * Notifies the player they've been jailed and applies roleblock.
   *
   * @returns
   */
  dayVisit() {
    if (this.dayVisiting === null) return;

    io.to(this.dayVisiting.player.user.socketId).emit(
      ServerEvent.ReceiveMessage,
      { key: MessageKey.YouHaveBeenJailed },
    );
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.JailorJailedTarget,
    });
    this.dayVisiting.jailed = this;
    this.dayVisiting.roleblocked = true;
  }

  /**
   * Processes the execution of the jailed player.
   * Inflicts 3 damage to execute the prisoner.
   *
   * @returns
   */
  visit() {
    if (this.visiting === null) return;

    this.visiting.receiveVisit(this);
    if (this.visiting.damage < CombatLevel.High) {
      this.visiting.damage = CombatLevel.High;
    }
    this.visiting.attackers.push(this);
  }

  /**
   * Processes post-visit effects. Resets jail status and provides defense to the jailed player.
   * If jailed player wasn't executed, increases their defense.
   *
   * @returns
   */
  handleVisits() {
    if (this.dayVisiting === null) return;

    this.dayVisiting.jailed = null;

    if (this.dayVisiting.baseDefence === CombatLevel.None) {
      this.dayVisiting.defence = CombatLevel.Low;
    }
  }
}
