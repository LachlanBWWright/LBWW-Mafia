import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";
import { fromThrowable } from "neverthrow";
import { RoleGroup } from "../roleGroup.js";

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

  constructor(room: Room, player: Player) {
    super(room, player);
  }

  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
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
