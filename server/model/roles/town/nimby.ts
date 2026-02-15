import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { io } from "../../../servers/socket.js";

export class Nimby extends Role {
  alertSlots = 3;

  name = "Nimby";
  group = "town";
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

  constructor(room: Room, player: Player) {
    super(room, player);
  }

  handleNightAction(_recipient: Player) {
    //Vote on who should be attacked
    if (this.alertSlots == 0)
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have no alerts left!",
      );
    else if (this.visiting == null) {
      this.visiting = this;
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have decided to go on alert.",
      );
    } else {
      this.visiting = null;
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have decided not to go on alert.",
      );
    }
  }

  visit() {
    //Visits a role, and gives their defence a minimum of one
    if (this.visiting != null) {
      if (this.visiting.defence == 0) {
        this.visiting.defence = 1; //Makes the protectee's defence at least 1
        this.alertSlots--;
      }
      this.visiting.receiveVisit(this);
    }
  }

  handleVisits() {
    if (this.visiting != null) {
      for (const visitor of this.visiting.visitors) {
        if (visitor != this && visitor != this.visiting) {
          if (visitor.damage == 0) visitor.damage = 1;
          //this.visiting.attackers.push(this); Deliberately excluded at this point
        }
      }
    }
  }
}
