import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

export class Tapper extends Role {
  name = "Tapper";
  group = RoleGroup.Town;
  baseDefence = 0;
  defence = 0;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = true;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = false;

  constructor(room: Room, player: Player) {
    super(room, player);
  }

  handleDayAction(recipient: Player) {
    //Handles the class' daytime action
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot tap yourself.",
      );
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to tap " + recipient.username + ".",
      );
      this.dayVisiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Invalid choice.");
    }
  }

  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot tap yourself.",
      );
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to tap " + recipient.username + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Invalid choice.");
    }
  }

  dayVisit() {
    //Visits a player, so that the wiretapper can see any messages that they send overnight.
    if (this.dayVisiting != null) {
      io.to(this.dayVisiting.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have been wiretapped! Any message you send can be heard by a tapper.",
      );
      if (this.dayVisiting !== null && this.dayVisiting !== undefined)
        this.dayVisiting.receiveDayVisit(this);
      this.dayVisiting.nightTapped = this;
    }
  }

  visit() {
    //Visits a player, so that the wiretapper can see who they whisper to tomorrow.
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      this.visiting.dayTapped = this;
    }
  }
}
