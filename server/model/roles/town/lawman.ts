import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { io } from "../../../servers/emitter.js";

export class Lawman extends Role {
  isInsane = false;

  name = "Lawman";
  group = "town";
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

  constructor(room: Room, player: Player) {
    super(room, player);
  }

  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    if (this.isInsane) {
      //Shoot at random
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have gone insane, and have no control over who you shoot.",
      );
    } else if (recipient == this.player) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You cannot shoot yourself.",
      );
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have chosen to attack " + recipient.playerUsername + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.socketId).emit("receiveMessage", "Invalid choice.");
    }
  }

  visit() {
    if (this.visiting != null) {
      //Visits the person of the player choice

      if (this.isInsane)
        io.to(this.player.socketId).emit(
          "receiveMessage",
          "You have gone insane, and are shooting someone randomly!",
        );
      if (this.visiting.damage == 0) this.visiting.damage = 1;
      this.visiting.attackers.push(this);

      this.visiting.receiveVisit(this);
      if (this.visiting.group == "town") {
        //Go insane if a member of the town got shot
        this.isInsane = true;
        io.to(this.player.socketId).emit(
          "receiveMessage",
          "You just shot a member of the town, and have been driven insane by the guilt!",
        );
      }
    }
  }
}
