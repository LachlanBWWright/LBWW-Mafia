import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

/**
 * A neutral killer role that wins by eliminating all other players.
 * Can attack anyone at night without factional restrictions.
 * 
 * @class Maniac
 * @extends {Role}
 */
export class Maniac extends Role {
  name = "Maniac";
  group = RoleGroup.Maniac;
  baseDefence = 1;
  defence = 1;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Maniac instance.
   * 
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Maniac to choose a player to attack.
   * Validates that the target is not self and is alive.
   * 
   * @param {Player} recipient - The target player to attack
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot attack yourself.",
      );
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to attack " + recipient.username + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Invalid choice.");
    }
  }

  /**
   * Processes the visit by attacking the target with 1 damage.
   * 
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      if (this.visiting.damage == 0) {
        this.visiting.damage = 1;
      }
      this.visiting.receiveVisit(this);
    }
  }
}
