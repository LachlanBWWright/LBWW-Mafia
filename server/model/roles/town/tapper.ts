import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that wiretaps players' communications.
 * Taps daytime messages via day action and nighttime messages via night action.
 * Can hear all messages sent by tapped players during the next period.
 *
 * @class Tapper
 * @extends {Role}
 */

export class Tapper extends Role {
  name = "Tapper";
  group = RoleGroup.Town;
  baseDefence = CombatLevel.None;
  defence = CombatLevel.None;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = true;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Tapper instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the day action by allowing the Tapper to wiretap a player's daytime communications.
   * Validates that the target is not self and is alive.
   *
   * @param {Player} recipient - The target player to tap
   * @returns {void}
   */
  handleDayAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotTapSelf,
      });
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.ChoseToTap,
        params: { targetName: recipient.username },
      });
      this.dayVisiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.InvalidChoice,
      });
    }
  }

  /**
   * Handles the night action by allowing the Tapper to wiretap a player's nighttime communications.
   * Validates that the target is not self and is alive.
   *
   * @param {Player} recipient - The target player to tap
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotTapSelf,
      });
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.ChoseToTap,
        params: { targetName: recipient.username },
      });
      this.visiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.InvalidChoice,
      });
    }
  }

  /**
   * Processes the day tap by notifying the target and registering the tap for message capture.
   *
   * @returns {void}
   */
  dayVisit() {
    if (this.dayVisiting != null) {
      io.to(this.dayVisiting.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        { key: MessageKey.YouHaveBeenWiretapped },
      );
      if (this.dayVisiting !== null && this.dayVisiting !== undefined)
        this.dayVisiting.receiveDayVisit(this);
      this.dayVisiting.nightTapped = this;
    }
  }

  /**
   * Processes the night tap by registering the tap to capture day messages.
   *
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      this.visiting.dayTapped = this;
    }
  }
}
