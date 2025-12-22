import { type Player } from "../../player/player.js";
import { type Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleName, RoleGroup } from "../../../../shared/roles/roleEnums.js";

export class Framer extends Role {
  victoryCondition = false;
  target: Player | null = null; //Target to kill (player object)

  name = RoleName.Framer;
  group = RoleGroup.Neutral;
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
    const length = this.room.playerList.length;
    const index = Math.floor(Math.random() * length);
    for (let i = 0; i < length; i++) {
      //console.log((index + i) % length)
      //console.log(this.room.playerList[(index + i) % length])
      const target = this.room.playerList[(index + i) % length];
      if (target && target.role.group === RoleGroup.Town && target.isAlive) {
        this.target = target ?? null;
        this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
          name: "receiveMessage",
          data: {
            message:
              "Your target is " +
              this.target.playerUsername +
              ". You will win the game if you get them voted out. If your target dies before day 5, they will be replaced.",
          },
        });
        break;
      }
    }
  }

  dayUpdate() {
    //Updates the target
    if (this.target?.isAlive ?? this.victoryCondition) return; //Nothing happens if the target isn't dead, or the player's already won.
    const length = this.room.playerList.length;
    const index = Math.floor(Math.random() * length);
    for (let i = 0; i < length; i++) {
      const potentialTarget = this.room.playerList[(index + i) % length];
      if (
        potentialTarget &&
        potentialTarget.role.group === RoleGroup.Town &&
        potentialTarget.isAlive
      ) {
        this.target = potentialTarget;
        this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
          name: "receiveMessage",
          data: {
            message:
              "Your new target is " +
              this.target.playerUsername +
              ". You will win the game if you get them voted out. If your target dies before day 5, they will be replaced.",
          },
        });
        break;
      }
    }
  }
}
