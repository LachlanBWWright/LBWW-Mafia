import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that shoots players at night.
 * Becomes insane if they shoot a fellow Town member, preventing them from choosing targets afterward.
 *
 * @class Lawman
 * @extends {Role}
 */

export class Lawman extends Role {
  /**
   * Whether this Lawman has gone insane from shooting a Town member.
   * @type {boolean}
   */
  isInsane = false;

  name = "Lawman";
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
   * Creates a new Lawman instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Lawman to choose a player to shoot.
   * If insane, the shoot target is random and uncontrollable.
   * Validates that the target is not self and is alive.
   *
   * @param {Player} recipient - The target player to shoot (or random if insane)
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (this.isInsane) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.LawmanInsane,
      });
    } else if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.LawmanCannotShootSelf,
      });
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.ChoseToAttack,
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
   * Processes the shoot visit. Inflicts 1 damage on target and goes insane if target is Town.
   *
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      if (this.isInsane)
        io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.LawmanInsaneShooting,
        });
      if (this.visiting.damage == CombatLevel.None)
        this.visiting.damage = CombatLevel.Low;
      this.visiting.attackers.push(this);

      this.visiting.receiveVisit(this);
      if (this.visiting.group == RoleGroup.Town) {
        this.isInsane = true;
        io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.LawmanShotTownMember,
        });
      }
    }
  }
}
