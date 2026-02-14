import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { io } from "../../../servers/socket.js";
import { fromThrowable } from "neverthrow";

export class Watchman extends Role {
  name = "Watchman";
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
        "You cannot watch yourself.",
      );
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have chosen to watch " + recipient.playerUsername + ".",
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
          let allVisitors = this.visiting.visitors.length;
          if (allVisitors == 1) {
            //Tells the player that nobody's visited their target - The one visiter being the watchman themself.
            io.to(this.player.socketId).emit(
              "receiveMessage",
              "Nobody visited your target.",
            );
          } else if (allVisitors == 2) {
            let alibi =
              this.room.playerList[
                Math.floor(Math.random() * this.room.playerList.length)
              ].role;
            if (
              !alibi.player.isAlive ||
              alibi == this.visiting.visitors[0] ||
              alibi == this.visiting.visitors[1] ||
              alibi == this.visiting
            ) {
              //Reveals the only player visited if the random selection is dead, visitor, the person being watched, or the watchman
              if (this.visiting.visitors[0] == this) {
                io.to(this.player.socketId).emit(
                  "receiveMessage",
                  "Your target was visited by " +
                    this.visiting.visitors[1].player.playerUsername +
                    ".",
                );
              } else {
                io.to(this.player.socketId).emit(
                  "receiveMessage",
                  "Your target was visited by " +
                    this.visiting.visitors[0].player.playerUsername +
                    ".",
                );
              }
            } else {
              //Reveals the visitor, alongside the 'red herring' alibi.
              let realVisitor;
              if (this.visiting.visitors[0] == this) {
                realVisitor = this.visiting.visitors[1];
              } else {
                realVisitor = this.visiting.visitors[0];
              }

              if (Math.random() > 0.5) {
                io.to(this.player.socketId).emit(
                  "receiveMessage",
                  "Your target was visited by " +
                    realVisitor.player.playerUsername +
                    " or " +
                    alibi.player.playerUsername +
                    ".",
                );
              } else {
                io.to(this.player.socketId).emit(
                  "receiveMessage",
                  "Your target was visited by " +
                    alibi.player.playerUsername +
                    " or " +
                    realVisitor.player.playerUsername +
                    ".",
                );
              }
            }
          } else {
            let visitorList = [];
            for (let i = 0; i < this.visiting.visitors.length; i++) {
              if (
                this.visiting.visitors[i].player.isAlive &&
                this.visiting.visitors[i] != this
              ) {
                //Lists all visitors, excluding the watchman itself
                visitorList.push(this.visiting.visitors[i]);
              }
            }

            let visitorAnnouncement = "The list of visitors is: ";
            for (let i = 0; i < visitorList.length - 1; i++) {
              visitorAnnouncement = visitorAnnouncement.concat(
                visitorList[i].player.playerUsername + ", ",
              );
            }
            visitorAnnouncement = visitorAnnouncement.concat(
              "and " +
                visitorList[visitorList.length - 1].player.playerUsername +
                ".",
            );
            io.to(this.player.socketId).emit(
              "receiveMessage",
              visitorAnnouncement,
            );
          }
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
