import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that can go on alert at night for protection.
 * Has a limited number of alert slots (3) and counterattacks visitors while alert.
 * 
 * @class Nimby
 * @extends {Role}
 */
export class Nimby extends Role {
  /**
   * Number of remaining alert slots for this Nimby.
   * @type {number}
   */
  alertSlots = 3;

  name = "Nimby";
  group = RoleGroup.Town;
  baseDefence = 0;
  defence = 0;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = true;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Nimby instance.
   * 
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by toggling alert status.
   * Uses one alert slot if turning on alert. Must have slots remaining.
   * 
   * @param {Player} _recipient - Not used; Nimby only affects self
   * @returns {void}
   */
  handleNightAction(_recipient: Player) {
    if (this.alertSlots == 0)
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have no alerts left!",
      );
    else if (this.visiting == null) {
      this.visiting = this;
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have decided to go on alert.",
      );
    } else {
      this.visiting = null;
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have decided not to go on alert.",
      );
    }
  }

  /**
   * Processes the alert visit by increasing self defense and consuming an alert slot.
   * 
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      if (this.visiting.defence == 0) {
        this.visiting.defence = 1;
        this.alertSlots--;
      }
      this.visiting.receiveVisit(this);
    }
  }

  /**
   * Counterattacks any visitors to self while on alert.
   * Inflicts 1 damage to counterattacked visitors (except self and duplicate entries).
   * 
   * @returns {void}
   */
  handleVisits() {
    if (this.visiting != null) {
      for (const visitor of this.visiting.visitors) {
        if (visitor != this && visitor != this.visiting) {
          if (visitor.damage == 0) visitor.damage = 1;
        }
      }
    }
  }
}
