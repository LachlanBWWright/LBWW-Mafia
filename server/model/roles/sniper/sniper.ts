import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { io } from "../../../servers/emitter.js";

export class Sniper extends Role {
  lastVisited: Role | null = null;

  name = "Sniper";
  group = "sniper";
  baseDefence = 1;
  defence = 1;
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
    if (recipient == this.player) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You cannot snipe yourself.",
      );
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have chosen to snipe " + recipient.playerUsername + ".",
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
    } else this.lastVisited = null;
  }

  handleVisits() {
    if (this.visiting != null) {
      if (
        this.visiting.visiting == this.visiting ||
        this.visiting.visiting == null
      ) {
        if (this.visiting.damage < 3) this.visiting.damage = 3;
      } else if (this.lastVisited == this.visiting) {
        if (this.visiting.damage == 0) this.visiting.damage = 1;
      }
      this.lastVisited = this.visiting;
    }
  }
}
