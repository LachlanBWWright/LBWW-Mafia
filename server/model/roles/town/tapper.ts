import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { io } from "../../../servers/emitter.js";

export class Tapper extends Role {
  name = "Tapper";
  group = "town";
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
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You cannot tap yourself.",
      );
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have chosen to tap " + recipient.playerUsername + ".",
      );
      this.dayVisiting = recipient.role;
    } else {
      io.to(this.player.socketId).emit("receiveMessage", "Invalid choice.");
    }
  }

  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    if (recipient == this.player) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You cannot tap yourself.",
      );
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have chosen to tap " + recipient.playerUsername + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.socketId).emit("receiveMessage", "Invalid choice.");
    }
  }

  dayVisit() {
    //Visits a player, so that the wiretapper can see any messages that they send overnight.
    if (this.dayVisiting != null) {
      io.to(this.dayVisiting.player.socketId).emit(
        "receiveMessage",
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
