import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { RoleMafia } from "./abstractMafiaRole.js";
import { io } from "../../../servers/socket.js";

export class MafiaSilencer extends RoleMafia {
  name = "Mafia Silencer";
  group = "mafia";
  baseDefence = 0;
  defence = 0;
  roleblocker = true;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = true;

  constructor(room: Room, player: Player) {
    super(room, player);
  }

  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    if (recipient == this.player) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You cannot silence yourself.",
      );
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have chosen to silence " + recipient.playerUsername + ".",
      );
      this.visiting = recipient.role;
    } else {
      io.to(this.player.socketId).emit("receiveMessage", "Invalid choice.");
    }
  }

  defaultVisit() {
    //This visits a role and attacks them. this.visiting is dictated by the faction Class.
    if (this.visiting != null) {
      if (this.visiting.group == "town" || Math.random() > 0.5) {
        this.visiting.roleblocked = true;
        this.visiting.receiveVisit(this);
      }
    }
  }
}
