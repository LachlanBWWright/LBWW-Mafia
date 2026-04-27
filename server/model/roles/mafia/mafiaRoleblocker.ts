import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { RoleMafia } from "./abstractMafiaRole.js";
import { RoleGroup } from "../roleGroup.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

/**
 * A Mafia role with roleblocker abilities. Can block a player's action during the night phase,
 * preventing them from using their night ability.
 * 
 * @class MafiaRoleblocker
 * @extends {RoleMafia}
 */
export class MafiaRoleblocker extends RoleMafia {
  name = "Mafia Roleblocker";
  group = RoleGroup.Mafia;
  baseDefence = 0;
  defence = 0;
  roleblocker = true;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = true;

  /**
   * Creates a new MafiaRoleblocker instance.
   * 
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the roleblocker to choose a player to block.
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
   * Performs the block visit by marking the target as roleblocked.
   * Blocks succeeds on Town targets; has a 50% chance to succeed on other roles.
   * 
   * @returns {void}
   */
  defaultVisit() {
    if (this.visiting != null) {
      if (this.visiting.group == RoleGroup.Town || Math.random() > 0.5) {
        this.visiting.roleblocked = true;
        this.visiting.receiveVisit(this);
      }
    }
  }
}
