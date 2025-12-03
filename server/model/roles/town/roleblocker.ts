import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleName, RoleGroup } from "../../../shared/roles/roleEnums";
import {
  FIFTY_FIFTY_CHANCE,
  BASE_DEFENSE,
} from "../../../constants/gameConstants.js";

/**
 * Roleblocker role - Prevents other players from using their night abilities
 *
 * Can target a player at night to roleblock them. Always successful against
 * town members, 50% chance against non-town members.
 */
export class Roleblocker extends Role {
  name = RoleName.Roleblocker;
  group = RoleGroup.Town;
  baseDefence = BASE_DEFENSE;
  defence = BASE_DEFENSE;
  roleblocker = true;
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
   * Processes night action to select a target to roleblock
   * @param recipient The player to roleblock
   */
  handleNightAction(recipient: Player) {
    //Choose who should be roleblocked
    if (recipient == this.player) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You cannot block yourself." },
      });
    } else if (recipient.playerUsername != undefined && recipient.isAlive) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message: "You have chosen to block " + recipient.playerUsername + ".",
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
   * Executes the roleblock attempt
   * Always successful against town, 50% chance against others
   */
  visit() {
    // Visits a role and attempts to roleblock them
    if (this.visiting != null) {
      if (
        this.visiting.group === RoleGroup.Town ||
        Math.random() > FIFTY_FIFTY_CHANCE
      ) {
        this.visiting.roleblocked = true;
        this.visiting.receiveVisit(this);
      }
    }
  }
}
