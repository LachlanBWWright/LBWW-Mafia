import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleName, RoleGroup } from "../../../shared/roles/roleEnums";

export class Watchman extends Role {
  name = RoleName.Watchman;
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
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You cannot watch yourself." },
      });
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message: "You have chosen to watch " + recipient.playerUsername + ".",
        },
      });
      this.visiting = recipient.role;
    } else {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "Invalid choice." },
      });
    }
  }

  visit() {
    //Visits a role, and gives their defence a minimum of one
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
    }
  }

  handleVisits() {
    try {
      if (this.visiting != null) {
        let allVisitors = this.visiting.visitors.length;
        if (allVisitors == 1) {
          //Tells the player that nobody's visited their target - The one visiter being the watchman themself.
          this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
            name: "receiveMessage",
            data: { message: "Nobody visited your target." },
          });
        } else if (allVisitors == 2) {
          let alibiPlayer =
            this.room.playerList[
              Math.floor(Math.random() * this.room.playerList.length)
            ];

          if (!alibiPlayer) {
            return;
          }
          const alibi = alibiPlayer.role;

          if (
            !alibi.player.isAlive ||
            alibi == this.visiting.visitors[0] ||
            alibi == this.visiting.visitors[1] ||
            alibi == this.visiting
          ) {
            //Reveals the only player visited if the random selection is dead, visitor, the person being watched, or the watchman
            if (this.visiting.visitors[0] == this) {
              this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
                name: "receiveMessage",
                data: {
                  message:
                    "Your target was visited by " +
                    this.visiting.visitors[1]?.player.playerUsername +
                    ".",
                },
              });
            } else {
              this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
                name: "receiveMessage",
                data: {
                  message:
                    "Your target was visited by " +
                    this.visiting.visitors[0]?.player.playerUsername +
                    ".",
                },
              });
            }
          } else {
            //Reveals the visitor, alongside the 'red herring' alibi.
            const realVisitor =
              this.visiting.visitors[0] == this
                ? this.visiting.visitors[1]
                : this.visiting.visitors[0];
            if (!realVisitor) {
              return;
            }

            if (Math.random() > 0.5) {
              this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
                name: "receiveMessage",
                data: {
                  message:
                    "Your target was visited by " +
                    realVisitor.player.playerUsername +
                    " or " +
                    alibi.player.playerUsername +
                    ".",
                },
              });
            } else {
              this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
                name: "receiveMessage",
                data: {
                  message:
                    "Your target was visited by " +
                    alibi.player.playerUsername +
                    " or " +
                    realVisitor.player.playerUsername +
                    ".",
                },
              });
            }
          }
        } else {
          let visitorList = [];
          for (const visitingVisitor of this.visiting.visitors) {
            if (visitingVisitor.player.isAlive && visitingVisitor != this) {
              //Lists all visitors, excluding the watchman itself
              visitorList.push(visitingVisitor);
            }
          }

          let visitorAnnouncement = "The list of visitors is: ";
          for (let i = 0; i < visitorList.length - 1; i++) {
            visitorAnnouncement = visitorAnnouncement.concat(
              visitorList[i]?.player.playerUsername + ", ",
            );
          }
          visitorAnnouncement = visitorAnnouncement.concat(
            "and " +
              visitorList[visitorList.length - 1]?.player.playerUsername +
              ".",
          );
          this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
            name: "receiveMessage",
            data: { message: visitorAnnouncement },
          });
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
}
