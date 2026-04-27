import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";
import { fromThrowable } from "neverthrow";
import { RoleGroup } from "../roleGroup.js";

/**
 * A Town role that tracks other players' movements at night.
 * Reveals who the tracked player visited during the night.
 * 
 * @class Tracker
 * @extends {Role}
 */
export class Tracker extends Role {
  name = "Tracker";
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
   * Creates a new Tracker instance.
   * 
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Tracker to choose a player to track.
   * Validates that the target is not self and is alive.
   * 
   * @param {Player} recipient - The target player to track
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot track yourself.",
      );
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to track " + recipient.username + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Invalid choice.");
    }
  }

  /**
   * Processes the track visit by registering the tracker for visit observation.
   * 
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
    }
  }

  /**
   * Handles the visit results by reporting where the tracked player visited.
   * If the target didn't visit anyone, reports that instead.
   * 
   * @returns {void}
   */
  handleVisits() {
    const handleVisits = fromThrowable(
      () => {
        if (this.visiting != null) {
          if (this.visiting.visiting)
            io.to(this.player.user.socketId).emit(
              ServerEvent.ReceiveMessage,
              "Your target visited " +
                this.visiting.visiting.player.username +
                ".",
            );
          else
            io.to(this.player.user.socketId).emit(
              ServerEvent.ReceiveMessage,
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
