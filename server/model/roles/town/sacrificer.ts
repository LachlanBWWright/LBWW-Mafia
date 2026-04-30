import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that sacrifices themselves to protect a target from attacks.
 * If the protected target is attacked, the Sacrificer dies and reveals all attackers to the target.
 *
 * @class Sacrificer
 * @extends {Role}
 */
export class Sacrificer extends Role {
  name = "Sacrificer";
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
   * Creates a new Sacrificer instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Sacrificer to choose a player to protect.
   * Validates that the target is not self and is alive.
   *
   * @param {Player} recipient - The target player to protect
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot protect yourself.",
      );
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to protect " + recipient.username + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "Invalid choice.",
      );
    }
  }

  /**
   * Processes the protect visit by registering for the visit.
   *
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
    }
  }

  /**
   * Processes attacks on the protected target. If attacked, sacrifices self and reveals attackers.
   * Gives the target maximum defense (3) and identifies all attackers to them.
   *
   * @returns {void}
   */
  handleVisits() {
    if (this.visiting != null && this.visiting.attackers.length > 0) {
      this.visiting.defence = CombatLevel.High;
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have died protecting your target.",
      );
      io.to(this.visiting.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You were attacked, but were saved by a sacrificer!",
      );
      this.damage = CombatLevel.Critical;
      for (const attacker of this.visiting.attackers) {
        io.to(this.visiting.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "You were attacked by " +
            attacker.player.username +
            ", whose role is: " +
            attacker.name +
            ".",
        );
      }
    }
  }
}
