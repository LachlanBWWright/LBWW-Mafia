import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that builds fortifications on other players' houses to protect them.
 * Can fortify one house at a time with +2 permanent defense.
 * Can later try to remove fortifications, risking death to either the Fortifier or the original owner.
 *
 * @class Fortifier
 * @extends {Role}
 */
export class Fortifier extends Role {
  /**
   * The role of the player whose house is currently fortified.
   * @type {Role | null}
   */
  playerFortified: Role | null = null;
  /**
   * Whether the Fortifier can currently build new fortifications.
   * Becomes false after fortifying, true again if fortifications are removed.
   * @type {boolean}
   */
  canFortify = true;

  name = "Fortifier";
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
   * Creates a new Fortifier instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action to either fortify a new house or remove existing fortifications.
   * Can only fortify when canFortify is true; can only remove fortifications when fortifications exist.
   * Validates targets and provides appropriate error messages.
   *
   * @param {Player} recipient - The target player's house to fortify or defortify
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot fortify your own house.",
      );
    } else if (
      recipient.username != undefined &&
      recipient.isAlive &&
      this.canFortify
    ) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to fortify " + recipient.username + "'s house.",
      );
      this.visiting = recipient.role;
    } else if (this.playerFortified != null) {
      if (
        recipient.username != undefined &&
        this.playerFortified.player.isAlive &&
        !this.canFortify
      ) {
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "You have chosen to try and remove " +
            this.playerFortified.player.username +
            "'s fortifications.",
        );
        this.visiting = recipient.role;
      } else {
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "You cannot remove the fortifications from a dead player's house.",
        );
      }
    } else {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "Invalid choice.",
      );
    }
  }

  /**
   * Processes the visit to either build new fortifications or remove existing ones.
   * Building increases target's base defense by 2.
   * Removing fortifications has a 50% chance to kill either the Fortifier or the original owner.
   *
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      if (this.canFortify) {
        this.canFortify = false;
        this.visiting.baseDefence += CombatLevel.Medium;
        this.playerFortified = this.visiting;
        io.to(this.playerFortified.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "Your house has been fortified!",
        );
      } else if (this.playerFortified !== null) {
        this.visiting.baseDefence -= CombatLevel.Medium;
        if (Math.random() > 0.5) {
          io.to(this.player.user.socketId).emit(
            ServerEvent.ReceiveMessage,
            "You died stripping the house of your fortifications.",
          );
          io.to(this.playerFortified.player.user.socketId).emit(
            ServerEvent.ReceiveMessage,
            `${this.playerFortified.player.username} died stripping your house of its fortifications.`,
          );
          this.damage = CombatLevel.Fatal;
        } else {
          io.to(this.player.user.socketId).emit(
            ServerEvent.ReceiveMessage,
            "You stripped the house of its fortifications, and killed the owner.",
          );
          io.to(this.playerFortified.player.user.socketId).emit(
            ServerEvent.ReceiveMessage,
            "You died trying to stop your house from being stripped of its fortifications.",
          );
          this.playerFortified.damage = CombatLevel.Fatal;
        }
      }
    }
  }

  /**
   * Counterattacks attackers on the fortified house.
   * Inflicts 1 damage to attackers (except self and the original fortress owner).
   *
   * @returns {void}
   */
  handleVisits() {
    if (this.playerFortified != null && this.visiting !== null) {
      for (const attacker of this.visiting.attackers) {
        if (attacker != this && attacker != this.visiting) {
          if (attacker.damage == CombatLevel.None)
            attacker.damage = CombatLevel.Low;
          attacker.attackers.push(this);
        }
      }
    }
  }
}
