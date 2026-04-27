import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that inspects players and guesses their role.
 * Provides three possible role guesses with 30% chance of accuracy.
 * 
 * @class Investigator
 * @extends {Role}
 */
export class Investigator extends Role {
  name = "Investigator";
  group = RoleGroup.Town;
  baseDefence = 0;
  defence = 0;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Investigator instance.
   * 
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Investigator to choose a player to inspect.
   * Validates that the target is not self and is alive.
   * 
   * @param {Player} recipient - The target player to inspect
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot inspect yourself.",
      );
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to inspect " + recipient.username + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Invalid choice.");
    }
  }

  /**
   * Processes the inspection visit by generating three role guesses.
   * Each guess has a 30% chance of being the actual target role; otherwise a random role.
   * 
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      let possibleRoles = [];
      for (const randomRoll of [Math.random(), Math.random(), Math.random()]) {
        if (randomRoll < 0.3) {
          possibleRoles.push(this.visiting.name);
        } else {
          possibleRoles.push(
            this.room.playerList[
              Math.floor(Math.random() * this.room.playerList.length)
            ].role.name,
          );
        }
      }
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        this.visiting.player.username +
          "'s role might be " +
          possibleRoles[0] +
          ", " +
          possibleRoles[1] +
          ", or " +
          possibleRoles[2] +
          ".",
      );
    }
  }
}
