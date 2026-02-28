import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { io } from "../../../servers/emitter.js";

export class Framer extends Role {
  victoryCondition = false;
  target: Player | null = null; //Target to kill (player object)

  name = "Framer";
  group = "neutral";
  baseDefence = 1;
  defence = 1;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = false;

  constructor(room: Room, player: Player) {
    super(room, player);

    this.room.framer = this;
  }

  initRole() {
    // Find a random target
    let length = this.room.playerList.length;
    let index = Math.floor(Math.random() * length);
    for (const i of Array.from({ length }, (_, index) => index)) {
      //console.log((index + i) % length)
      //console.log(this.room.playerList[(index + i) % length])
      if (
        this.room.playerList[(index + i) % length].role.group === "town" &&
        this.room.playerList[(index + i) % length].isAlive
      ) {
        this.target = this.room.playerList[(index + i) % length];
        io.to(this.player.socketId).emit(
          "receiveMessage",
          "Your target is " +
            this.target.playerUsername +
            ". You will win the game if you get them voted out. If your target dies before day 5, they will be replaced.",
        );
        break;
      }
    }
  }

  dayUpdate() {
    //Updates the target
    if (this.target?.isAlive || this.victoryCondition) return; //Nothing happens if the target isn't dead, or the player's already won.
    let length = this.room.playerList.length;
    let index = Math.floor(Math.random() * length);
    for (const i of Array.from({ length }, (_, index) => index)) {
      if (
        this.room.playerList[(index + i) % length].role.group === "town" &&
        this.room.playerList[(index + i) % length].isAlive
      ) {
        this.target = this.room.playerList[(index + i) % length];
        io.to(this.player.socketId).emit(
          "receiveMessage",
          "Your new target is " +
            this.target.playerUsername +
            ". You will win the game if you get them voted out. If your target dies before day 5, they will be replaced.",
        );
        break;
      }
    }
  }
}
