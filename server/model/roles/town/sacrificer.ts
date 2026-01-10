import { type Player } from "../../player/player.js";
import { type Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleName, RoleGroup } from "../../../../shared/roles/roleEnums.js";

export class Sacrificer extends Role {
  name = RoleName.Sacrificer;
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

  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    if (recipient == this.player) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You cannot protect yourself." },
      });
    } else if (recipient.isAlive) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message:
            "You have chosen to protect " + recipient.playerUsername + ".",
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
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
    }
  }

  handleVisits() {
    if (this.visiting != null && this.visiting.attackers.length > 0) {
      this.visiting.defence = 3;
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You have died protecting your target." },
      });
      this.room.socketHandler.sendPlayerMessage(this.visiting.player.socketId, {
        name: "receiveMessage",
        data: { message: "You were attacked, but were saved by a sacrificer!" },
      });
      this.damage = 99; //Makes the sacrificer die
      for (const attacker of this.visiting.attackers) {
        this.room.socketHandler.sendPlayerMessage(
          this.visiting.player.socketId,
          {
            name: "receiveMessage",
            data: {
              message:
                "You were attacked by " +
                attacker.player.playerUsername +
                ", whose role is: " +
                attacker.name +
                ".",
            },
          },
        );
      }
    }
  }
}
