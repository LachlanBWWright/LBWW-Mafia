import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that protects other players at night.
 * Increases the protection target's defense and counterattacks visitors.
 *
 * @class Bodyguard
 * @extends {Role}
 */

export class Bodyguard extends Role {
  name = "Bodyguard";
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
   * Creates a new Bodyguard instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Bodyguard to choose a player to protect.
   * Validates that the target is not self and is alive.
   *
   * @param {Player} recipient - The target player to protect
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient === this.player) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotProtectSelf,
      });
      return;
    }

    if (recipient.username !== undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.ChoseToProtect,
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
   * Processes the protection visit by increasing the target's defense to at least 1.
   *
   * @returns {void}
   */
  visit() {
    if (this.visiting === null) return;

    if (this.visiting.defence === CombatLevel.None) {
      this.visiting.defence = CombatLevel.Low;
    }
    this.visiting.receiveVisit(this);
  }

  /**
   * Counterattacks any visitors to the protected target (except self and target).
   * Inflicts 1 damage to counterattacked visitors.
   *
   * @returns {void}
   */
  handleVisits() {
    if (this.visiting === null) return;

    for (const visitor of this.visiting.visitors) {
      if (visitor === this || visitor === this.visiting) continue;

      if (visitor.damage === CombatLevel.None) {
        visitor.damage = CombatLevel.Low;
      }
      visitor.attackers.push(this);
    }
  }
}
