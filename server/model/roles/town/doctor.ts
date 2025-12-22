import { type Player } from "../../player/player.js";
import { type Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleName, RoleGroup } from "../../../../shared/roles/roleEnums.js";
import {
  BASE_DEFENSE,
  BASIC_ATTACK_DAMAGE,
} from "../../../constants/gameConstants.js";

/**
 * Doctor role - Heals other players to protect them from attacks
 *
 * Can visit another player at night to heal them, providing basic defense
 * against most forms of attack. Cannot heal themselves.
 */
export class Doctor extends Role {
  name = RoleName.Doctor;
  group = RoleGroup.Town;
  baseDefence = BASE_DEFENSE;
  defence = BASE_DEFENSE;
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

  /**
   * Processes night action to select a player to heal
   * @param recipient The player to heal (cannot be self)
   */
  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    if (recipient == this.player) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You cannot heal yourself." },
      });
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message: "You have chosen to heal " + recipient.playerUsername + ".",
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

  /**
   * Executes the healing, providing basic defense to the target
   */
  visit() {
    // Visits a role, and gives their defence a minimum of basic attack level
    if (this.visiting != null) {
      if (this.visiting.defence == 0) {
        this.visiting.defence = BASIC_ATTACK_DAMAGE; // Makes the healee's defence at least 1
      }
      this.visiting.receiveVisit(this);
    }
  }
}
