import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that judges players and determines their factional alignment.
 * Has a 70% chance to correctly identify alignment; otherwise returns a random alignment.
 *
 * @class Judge
 * @extends {Role}
 */
export class Judge extends Role {
  name = "Judge";
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
   * Creates a new Judge instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Judge to choose a player to inspect.
   * Validates that the target is not self and is alive.
   *
   * @param {Player} recipient - The target player to judge
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot inspect your own alignment.",
      );
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to inspect " + recipient.username + ".",
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
   * Processes the inspection visit by determining factional alignment.
   * Has a 30% chance to return false information; otherwise returns actual alignment.
   *
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);

      if (Math.random() < 0.3) {
        let livingPlayerList = [];
        for (const roomPlayer of this.room.playerList) {
          if (roomPlayer.isAlive) {
            livingPlayerList.push(roomPlayer);
          }
        }

        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          this.visiting.player.username +
            "'s alignment is for the " +
            livingPlayerList[
              Math.floor(Math.random() * livingPlayerList.length)
            ].role.group +
            " faction.",
        );
      } else {
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          this.visiting.player.username +
            "'s alignment is for the " +
            this.visiting.group +
            " faction.",
        );
      }
    }
  }
}
