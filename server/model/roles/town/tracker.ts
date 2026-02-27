import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { io } from "../../../servers/socket.js";
import { fromThrowable } from "neverthrow";

export class Tracker extends Role {
  name = "Tracker";
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
        "You cannot track yourself.",
      );
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have chosen to track " + recipient.playerUsername + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.socketId).emit("receiveMessage", "Invalid choice.");
    }
  }

  visit() {
    //Visits a role, and gives their defence a minimum of one
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
    }
  }

  handleVisits() {
    const handleVisits = fromThrowable(
      () => {
        if (this.visiting != null) {
          if (this.visiting.visiting)
            io.to(this.player.socketId).emit(
              "receiveMessage",
              "Your target visited " +
                this.visiting.visiting.player.playerUsername +
                ".",
            );
          else
            io.to(this.player.socketId).emit(
              "receiveMessage",
              "Your target didn't visit anyone.",
            );
        }
      },
      (error) => error,
    );
    const result = handleVisits();

    if (result.isErr()) {
      console.error(result.error);
    }
  }
}
