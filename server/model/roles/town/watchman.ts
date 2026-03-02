import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";
import { fromThrowable } from "neverthrow";
import { RoleGroup } from "../roleGroup.js";

export class Watchman extends Role {
  name = "Watchman";
  group = RoleGroup.Town;
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
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot watch yourself.",
      );
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to watch " + recipient.username + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Invalid choice.");
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
            io.to(this.player.user.socketId).emit(
              ServerEvent.ReceiveMessage,
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
                io.to(this.player.user.socketId).emit(
                  ServerEvent.ReceiveMessage,
                  "Your target was visited by " +
                    this.visiting.visitors[1].player.username +
                    ".",
                );
              } else {
                io.to(this.player.user.socketId).emit(
                  ServerEvent.ReceiveMessage,
                  "Your target was visited by " +
                    this.visiting.visitors[0].player.username +
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
                io.to(this.player.user.socketId).emit(
                  ServerEvent.ReceiveMessage,
                  "Your target was visited by " +
                    realVisitor.player.username +
                    " or " +
                    alibi.player.username +
                    ".",
                );
              } else {
                io.to(this.player.user.socketId).emit(
                  ServerEvent.ReceiveMessage,
                  "Your target was visited by " +
                    alibi.player.username +
                    " or " +
                    realVisitor.player.username +
                    ".",
                );
              }
            }
          } else {
            let visitorList = [];
            for (const visitor of this.visiting.visitors) {
              if (visitor.player.isAlive && visitor != this) {
                //Lists all visitors, excluding the watchman itself
                visitorList.push(visitor);
              }
            }

            let visitorAnnouncement = "The list of visitors is: ";
            for (const visitor of visitorList.slice(0, -1)) {
              visitorAnnouncement = visitorAnnouncement.concat(
                visitor.player.username + ", ",
              );
            }
            visitorAnnouncement = visitorAnnouncement.concat(
              "and " +
                visitorList[visitorList.length - 1].player.username +
                ".",
            );
            io.to(this.player.user.socketId).emit(
              ServerEvent.ReceiveMessage,
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
