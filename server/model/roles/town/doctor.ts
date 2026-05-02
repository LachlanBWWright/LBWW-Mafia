import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that heals other players at night.
 * Increases the target's defense to prevent damage.
 *
 * @class Doctor
 * @extends {Role}
 */

export class Doctor extends Role {
  name = "Doctor";
  group = RoleGroup.Town;
  baseDefence = CombatLevel.None;
  defence = CombatLevel.None;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Doctor instance.
   *
   * @param room - The game room
   * @param player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Doctor to choose a player to heal.
   * Validates that the target is not self and is alive.
   *
   * @param recipient - The target player to heal
   * @returns
   */
  handleNightAction(recipient: Player) {
    if (recipient === this.player) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.DoctorCannotHealSelf,
      });
      return;
    }

    if (recipient.username !== undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.DoctorChoseToHeal,
        params: { targetName: recipient.username },
      });
      this.visiting = recipient.role;
      return;
    }

    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.InvalidChoice,
    });
  }

  /**
   * Processes the heal visit by increasing the target's defense to at least 1.
   *
   * @returns
   */
  visit() {
    if (this.visiting === null) return;

    if (this.visiting.defence === CombatLevel.None) {
      this.visiting.defence = CombatLevel.Low;
    }
    this.visiting.receiveVisit(this);
  }
}
