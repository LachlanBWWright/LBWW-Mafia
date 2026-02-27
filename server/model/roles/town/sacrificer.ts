import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { io } from "../../../servers/socket.js";

export class Sacrificer extends Role {
  name = "Sacrificer";
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
    if (recipient == this.player) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You cannot protect yourself.",
      );
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have chosen to protect " + recipient.playerUsername + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.socketId).emit("receiveMessage", "Invalid choice.");
    }
  }

  visit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
    }
  }

  handleVisits() {
    if (this.visiting != null && this.visiting.attackers.length > 0) {
      this.visiting.defence = 3;
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have died protecting your target.",
      );
      io.to(this.visiting.player.socketId).emit(
        "receiveMessage",
        "You were attacked, but were saved by a sacrificer!",
      );
      this.damage = 99; //Makes the sacrificer die
      for (const attacker of this.visiting.attackers) {
        io.to(this.visiting.player.socketId).emit(
          "receiveMessage",
          "You were attacked by " +
            attacker.player.playerUsername +
            ", whose role is: " +
            attacker.name +
            ".",
        );
      }
    }
  }
}
