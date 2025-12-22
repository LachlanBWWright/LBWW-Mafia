import { type Player } from "../../player/player.js";
import { type Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleName, RoleGroup } from "../../../../shared/roles/roleEnums.js";

export class Lawman extends Role {
  isInsane = false;

  name = RoleName.Lawman;
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
    if (this.isInsane) {
      //Shoot at random
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message:
            "You have gone insane, and have no control over who you shoot.",
        },
      });
    } else if (recipient == this.player) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You cannot shoot yourself." },
      });
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message: "You have chosen to shoot " + recipient.playerUsername + ".",
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
      //Visits the person of the player choice

      if (this.isInsane)
        this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
          name: "receiveMessage",
          data: {
            message: "You have gone insane, and are shooting someone randomly!",
          },
        });
      if (this.visiting.damage == 0) this.visiting.damage = 1;
      this.visiting.attackers.push(this);

      this.visiting.receiveVisit(this);
      if (this.visiting.group === RoleGroup.Town) {
        //Go insane if a member of the town got shot
        this.isInsane = true;
        this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
          name: "receiveMessage",
          data: {
            message:
              "You just shot a member of the town, and have been driven insane by the guilt!",
          },
        });
      }
    }
  }
}
