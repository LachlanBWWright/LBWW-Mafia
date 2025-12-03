import { Role } from "../abstractRole.js";
import { RoleName, RoleGroup } from "../../../shared/roles/roleEnums";
import { Room } from "../../rooms/room.js";
import { Player } from "../../player/player.js";
import {
  VETTER_RESEARCH_SLOTS,
  FIFTY_FIFTY_CHANCE,
  BASE_DEFENSE,
} from "../../../constants/gameConstants.js";

/**
 * Vetter role - Researches random players to learn their alignments
 *
 * The Vetter can research players by staying home at night, revealing
 * the faction of random players. Has limited research sessions per game.
 */
export class Vetter extends Role {
  /** Number of research sessions remaining */
  researchSlots = VETTER_RESEARCH_SLOTS;

  name = RoleName.Vetter;
  group = RoleGroup.Town;
  baseDefence = BASE_DEFENSE;
  defence = BASE_DEFENSE;
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

  /**
   * Handles night action to toggle research mode
   * @param recipient Not used - Vetter visits themselves to research
   */
  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    if (this.researchSlots == 0)
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You have no research sessions left!" },
      });
    else if (this.visiting == null) {
      this.visiting = this;
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message:
            "You have decided to stay home and research into people's history.",
        },
      });
    } else {
      this.visiting = null;
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message: "You have decided not to research into people's history.",
        },
      });
    }
  }

  /**
   * Executes research by selecting and investigating random players
   */
  visit() {
    // Selects two random people to investigate
    try {
      // Gets two different players at random
      if (this.visiting === null) return;
      this.visiting.receiveVisit(this);
      this.researchSlots--;
      let randomPlayerOneIdx = Math.floor(
        Math.random() * this.room.playerList.length,
      );
      let randomPlayerTwoIdx = randomPlayerOneIdx;
      while (
        randomPlayerTwoIdx == randomPlayerOneIdx &&
        this.room.playerList.length > 1
      )
        randomPlayerTwoIdx = Math.floor(
          Math.random() * this.room.playerList.length,
        );

      const randomPlayerOne = this.room.playerList[randomPlayerOneIdx];
      const randomPlayerTwo = this.room.playerList[randomPlayerTwoIdx];

      if (!randomPlayerOne || !randomPlayerTwo) {
        console.log("Random player not found");
        return;
      }

      // Randomly choose which of the two players to reveal information about
      if (Math.random() > FIFTY_FIFTY_CHANCE) {
        this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
          name: "receiveMessage",
          data: {
            message:
              "You researched into " +
              randomPlayerOne.playerUsername +
              " and found out they are " +
              randomPlayerOne.role.group +
              ".",
          },
        });
      } else {
        this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
          name: "receiveMessage",
          data: {
            message:
              "You researched into " +
              randomPlayerTwo.playerUsername +
              " and found out they are " +
              randomPlayerTwo.role.group +
              ".",
          },
        });
      }
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: {
          message: `You have ${this.researchSlots} research sessions left.`,
        },
      });
    } catch (error) {
      console.log(error);
    }
  }
}
