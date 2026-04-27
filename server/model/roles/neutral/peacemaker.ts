import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

/**
 * A neutral role that wins by roleblocker another player at night.
 * Can block a single player each night to prevent their actions.
 * 
 * @class Peacemaker
 * @extends {Role}
 */
export class Peacemaker extends Role {
  victoryCondition: boolean = false;

  name = "Peacemaker";
  group = RoleGroup.Neutral;
  baseDefence = 0;
  defence = 0;
  roleblocker = true;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Peacemaker instance and registers itself with the room.
   * 
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
    this.victoryCondition = false;
    this.room.peacemaker = this;
  }

  /**
   * Handles the night action by allowing the Peacemaker to choose a player to block.
   * Validates that the target is not self and is alive.
   * 
   * @param {Player} recipient - The target player to block
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot block yourself.",
      );
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to block " + recipient.username + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Invalid choice.");
    }
  }

  /**
   * Processes the block visit by marking the target as roleblocked.
   * 
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      this.visiting.roleblocked = true;
      this.visiting.receiveVisit(this);
    }
  }
}
