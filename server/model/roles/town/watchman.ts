import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";
import { fromThrowable } from "neverthrow";
import { RoleGroup } from "../roleGroup.js";

/**
 * A Town role that watches other players to see who visits them at night.
 * Reports visitor information with varying accuracy based on visitor count:
 * - No visitors: Reports that nobody visited
 * - One visitor: Reveals the visitor's identity (or a false lead if random check)
 * - Multiple visitors: Lists all live visitors (or provides names with 50% chance of alibi)
 * 
 * @class Watchman
 * @extends {Role}
 */
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

  /**
   * Creates a new Watchman instance.
   * 
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Watchman to choose a player to watch.
   * Validates that the target is not self and is alive.
   * 
   * @param {Player} recipient - The target player to watch
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
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

  /**
   * Processes the watch visit by registering as a visitor.
   * 
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
    }
  }

  /**
   * Processes visitor information and reports to the Watchman.
   * Handles different cases based on number of visitors:
   * - 1 visitor (only Watchman): Reports nobody visited
   * - 2 visitors (Watchman + 1): Reveals the visitor (or false lead)
   * - 3+ visitors: Lists all or provides alibi option
   * 
   * @returns {void}
   */
  handleVisits() {
    const handleVisits = fromThrowable(
      () => {
        if (this.visiting != null) {
          let allVisitors = this.visiting.visitors.length;
          if (allVisitors == 1) {
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
