import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { io } from "../../../servers/socket.js";

//This class judges the alignment of the selected target (usually!)
export class Judge extends Role {
  name = "Judge";
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
        "You cannot inspect your own alignment.",
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

      if (Math.random() < 0.3) {
        let livingPlayerList = [];
        for (const roomPlayer of this.room.playerList) {
          if (roomPlayer.isAlive) {
            livingPlayerList.push(roomPlayer);
          }
        }

        io.to(this.player.socketId).emit(
          "receiveMessage",
          this.visiting.player.playerUsername +
            "'s alignment is for the " +
            livingPlayerList[
              Math.floor(Math.random() * livingPlayerList.length)
            ].role.group +
            " faction.",
        );
      } else {
        //Visits the right player, and returns their group (factional alignment)
        io.to(this.player.socketId).emit(
          "receiveMessage",
          this.visiting.player.playerUsername +
            "'s alignment is for the " +
            this.visiting.group +
            " faction.",
        );
      }
    }
  }
}
