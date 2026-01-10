import { type Player } from "../../player/player.js";
import { type Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleName, RoleGroup } from "../../../../shared/roles/roleEnums.js";

export class Fortifier extends Role {
  playerFortified: Role | null = null;
  canFortify = true;

  name = RoleName.Fortifier;
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
        data: { message: "You cannot fortify your own house." },
      });
    } else if (
      recipient.playerUsername != undefined &&
      recipient.isAlive &&
      this.canFortify
    ) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message:
            "You have chosen to fortify " +
            recipient.playerUsername +
            "'s house.",
        },
      });
      this.visiting = recipient.role;
    } else if (this.playerFortified != null) {
      if (
        recipient.playerUsername != undefined &&
        this.playerFortified.player.isAlive &&
        !this.canFortify
      ) {
        this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
          name: "receiveMessage",
          data: {
            message:
              "You have chosen to try and remove " +
              this.playerFortified.player.playerUsername +
              "'s fortifications.",
          },
        });
        this.visiting = recipient.role;
      } else {
        this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
          name: "receiveMessage",
          data: {
            message:
              "You cannot remove the fortifications from a dead player's house.",
          },
        });
      }
    } else {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "Invalid choice." },
      });
    }
  }

  visit() {
    //Builds the fortifications
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      if (this.canFortify) {
        //Builds fortifications
        this.canFortify = false;
        this.visiting.baseDefence += 2;
        this.playerFortified = this.visiting;
        this.room.socketHandler.sendPlayerMessage(
          this.playerFortified.player.socketId,
          {
            name: "receiveMessage",
            data: { message: "Your house has been fortified!" },
          },
        );
      } else if (this.playerFortified !== null) {
        //Attempts to remove fortifications
        this.visiting.baseDefence -= 2;
        if (Math.random() > 0.5) {
          this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
            name: "receiveMessage",
            data: {
              message: "You died stripping the house of your fortifications.",
            },
          });
          this.room.socketHandler.sendPlayerMessage(
            this.playerFortified.player.socketId,
            {
              name: "receiveMessage",
              data: {
                message: `${this.playerFortified.player.playerUsername} died stripping your house of its fortifications.`,
              },
            },
          );
          this.damage = 999;
        } else {
          this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
            name: "receiveMessage",
            data: {
              message:
                "You stripped the house of its fortifications, and killed the owner.",
            },
          });
          this.room.socketHandler.sendPlayerMessage(
            this.playerFortified.player.socketId,
            {
              name: "receiveMessage",
              data: {
                message:
                  "Your house was stripped of its fortifications, and you were killed.",
              },
            },
          );
          this.playerFortified.damage = 999;
        }
      }
    }
  }

  handleVisits() {
    //Attacks the attackers of the fortified person's house
    if (this.playerFortified != null && this.visiting !== null) {
      for (let i = 0; i < this.playerFortified.attackers.length; i++) {
        if (
          this.visiting.attackers[i] != this &&
          this.visiting.attackers[i] != this.visiting
        ) {
          const attacker = this.visiting.attackers[i];

          if (attacker === undefined) {
            continue;
          }
          if (attacker.damage == 0) attacker.damage = 1;
          attacker.attackers.push(this);
        }
      }
    }
  }
}
