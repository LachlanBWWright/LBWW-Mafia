import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleName, RoleGroup } from "../../../shared/roles/roleEnums";

//This class judges the alignment of the selected target (usually!)
export class Investigator extends Role {
  name = RoleName.Investigator;
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
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You cannot inspect yourself." },
      });
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message:
            "You have chosen to inspect " + recipient.playerUsername + ".",
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
    //Visits a role, and tries to determine their alignment.
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      let possibleRoles = [];
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.3) {
          //Give the targets role
          possibleRoles.push(this.visiting.name);
        } else {
          const randomPlayer =
            this.room.playerList[
              Math.floor(Math.random() * this.room.playerList.length)
            ];

          //Give a random player's role
          if (randomPlayer) {
            possibleRoles.push(randomPlayer.role.name);
          }
        }
      }
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message:
            this.visiting.player.playerUsername +
            "'s role might be " +
            possibleRoles[0] +
            ", " +
            possibleRoles[1] +
            ", or " +
            possibleRoles[2] +
            ".",
        },
      });
    }
  }
}
