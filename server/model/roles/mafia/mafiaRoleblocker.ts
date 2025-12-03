import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { RoleMafia } from "./abstractMafiaRole.js";
import { RoleName, RoleGroup } from "../../../shared/roles/roleEnums";
import {
  BASE_DEFENSE,
  FIFTY_FIFTY_CHANCE,
} from "../../../constants/gameConstants.js";

/**
 * Mafia Roleblocker - Mafia member who can roleblock other players
 *
 * Can roleblock players at night, preventing them from using abilities.
 * Always successful against town members, 50% chance against others.
 * Also participates in mafia faction attacks and coordination.
 */
export class MafiaRoleblocker extends RoleMafia {
  attackVote: Player | null = null;

  name = RoleName.MafiaRoleblocker;
  group = RoleGroup.Mafia;
  baseDefence = BASE_DEFENSE;
  defence = BASE_DEFENSE;
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

  /**
   * Processes night action to select a player to roleblock
   * @param recipient The player to roleblock (cannot be self)
   */
  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
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
   * Executes roleblock attempt when not attacking for the faction
   * Always successful against town, 50% chance against others
   */
  defaultVisit() {
    // This visits a role and roleblocks them (when not attacking for faction)
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
