import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { io } from "../../../servers/emitter.js";

//This class judges the alignment of the selected target (usually!)
export class Investigator extends Role {
  name = "Investigator";
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
        "You cannot inspect yourself.",
      );
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have chosen to inspect " + recipient.playerUsername + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.socketId).emit("receiveMessage", "Invalid choice.");
    }
  }

  visit() {
    //Visits a role, and tries to determine their alignment.
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      let possibleRoles = [];
      for (const randomRoll of [Math.random(), Math.random(), Math.random()]) {
        if (randomRoll < 0.3) {
          //Give the targets role
          possibleRoles.push(this.visiting.name);
        } else {
          //Give a random player's role
          possibleRoles.push(
            this.room.playerList[
              Math.floor(Math.random() * this.room.playerList.length)
            ].role.name,
          );
        }
      }
      io.to(this.player.socketId).emit(
        "receiveMessage",
        this.visiting.player.playerUsername +
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
