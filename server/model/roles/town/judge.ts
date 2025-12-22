import { type Player } from "../../player/player.js";
import { type Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleName, RoleGroup } from "../../../../shared/roles/roleEnums.js";
import {
  JUDGE_ERROR_RATE,
  BASE_DEFENSE,
} from "../../../constants/gameConstants.js";

/**
 * Judge role - Investigates player alignments with a chance of error
 *
 * The Judge can inspect other players at night to learn their faction,
 * but has a 30% chance of receiving incorrect information.
 */
export class Judge extends Role {
  name = RoleName.Judge;
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
   * Processes night action to inspect a target player
   * @param recipient The player to investigate
   */
  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    if (recipient == this.player) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You cannot inspect your own alignment." },
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

  /**
   * Executes the investigation, potentially giving wrong information
   */
  visit() {
    // Visits a role, and tries to determine their alignment.
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);

      if (Math.random() < JUDGE_ERROR_RATE) {
        // Judge gets wrong information - return a random player's faction
        const livingPlayerList = [];
        for (const player of this.room.playerList) {
          if (player.isAlive) {
            livingPlayerList.push(player);
          }
        }

        this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
          name: "receiveMessage",
          data: {
            message:
              this.visiting.player.playerUsername +
              "'s alignment is for the " +
              livingPlayerList[
                Math.floor(Math.random() * livingPlayerList.length)
              ]?.role.group +
              " faction.",
          },
        });
      } else {
        // Judge gets correct information
        this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
          name: "receiveMessage",
          data: {
            message:
              this.visiting.player.playerUsername +
              "'s alignment is for the " +
              this.visiting.group +
              " faction.",
          },
        });
      }
    }
  }
}
