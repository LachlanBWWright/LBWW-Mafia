import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleName, RoleGroup } from "../../../shared/roles/roleEnums";

export class Nimby extends Role {
  alertSlots = 3;

  name = RoleName.Nimby;
  group = RoleGroup.Town;
  baseDefence = 0;
  defence = 0;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = true;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = false;

  constructor(room: Room, player: Player) {
    super(room, player);
  }

  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    if (this.alertSlots == 0)
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You have no alerts left!" },
      });
    else if (this.visiting == null) {
      this.visiting = this;
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You have decided to go on alert." },
      });
    } else {
      this.visiting = null;
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You have decided not to go on alert." },
      });
    }
  }

  visit() {
    //Visits a role, and gives their defence a minimum of one
    if (this.visiting != null) {
      if (this.visiting.defence == 0) {
        this.visiting.defence = 1; //Makes the protectee's defence at least 1
        this.alertSlots--;
      }
      this.visiting.receiveVisit(this);
    }
  }

  handleVisits() {
    if (this.visiting != null) {
      for (let i = 0; i < this.visiting.visitors.length; i++) {
        const visitor: Role | undefined = this.visiting.visitors[i];

        if (!visitor) continue;
        // If the visitor is not the Nimby or the Nimby's target, and the visitor has no damage, set their damage to 1
        if (visitor != this && visitor != this.visiting) {
          if (visitor.damage == 0) visitor.damage = 1;
          //this.visiting.attackers.push(this); Deliberately excluded at this point
        }
      }
    }
  }
}
