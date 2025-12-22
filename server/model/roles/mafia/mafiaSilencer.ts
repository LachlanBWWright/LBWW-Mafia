import { type Player } from "../../player/player.js";
import { type Room } from "../../rooms/room.js";
import { RoleMafia } from "./abstractMafiaRole.js";
import { RoleName, RoleGroup } from "../../../../shared/roles/roleEnums.js";

export class MafiaSilencer extends RoleMafia {
  attackVote: Player | null = null;

  name = RoleName.MafiaSilencer;
  group = RoleGroup.Mafia;
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
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You cannot silence yourself." },
      });
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message:
            "You have chosen to silence " + recipient.playerUsername + ".",
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

  defaultVisit() {
    //This visits a role and attacks them. this.visiting is dictated by the faction Class.
    if (this.visiting != null) {
      if (this.visiting.group === RoleGroup.Town || Math.random() > 0.5) {
        this.visiting.roleblocked = true;
        this.visiting.receiveVisit(this);
      }
    }
  }
}
