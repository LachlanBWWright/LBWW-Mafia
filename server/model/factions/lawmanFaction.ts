import { Player } from "../player/player.js";
import { Faction } from "./abstractFaction.js";
import { Room } from "../rooms/room.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../servers/emitter.js";
import { fromThrowable } from "neverthrow";

const MAX_RANDOM_VISIT_ATTEMPTS = 100;

export class LawmanFaction extends Faction {
  room?: Room;

  /**
   * Finds all Lawman players from the given list and adds them to the memberList.
   * Sets the room reference from the first found Lawman member.
   *
   * @param {Player[]} playerList - List of all players in the game
   * @returns {void}
   */
  findMembers(playerList: Player[]) {
    for (const player of playerList) {
      if (player.role.name == "Lawman") {
        this.memberList.push(player);
      }
    }

    if (this.memberList.length > 0) this.room = this.memberList[0].role.room;

    this.initializeMembers();
  }

  /**
   * Handles night phase voting by forcing insane Lawman members to visit random alive players.
   * Attempts up to 100 times to find a valid alive target for each insane member.
   *
   * @returns {void}
   */
  handleNightVote() {
    if (this.room === undefined) return;
    for (const member of this.memberList) {
      if (member.role.isInsane) {
        for (let attempt = 0; attempt < MAX_RANDOM_VISIT_ATTEMPTS; attempt++) {
          const setRandomVisit = fromThrowable(
            () => {
              const randomIndex = Math.floor(
                Math.random() * this.room.playerList.length,
              );
              const randomVictim = this.room.playerList[randomIndex];
              if (randomVictim.isAlive) {
                console.log(randomVictim.role.name);
                member.role.visiting = randomVictim.role;
                return true;
              }
              return false;
            },
            (error) => error,
          );
          const result = setRandomVisit();

          if (result.isErr()) {
            console.error(result.error);
          } else if (result.value) {
            break;
          }
        }
      }
    }
  }

  /**
   * Sends a message to the specified player indicating they cannot speak during night phase.
   * Only the named player receives this message.
   *
   * @param {string} message - Not used; Lawman faction always sends a fixed message
   * @param {string} playerUsername - The username of the player to notify
   * @returns {void}
   */
  handleNightMessage(message: string, playerUsername: string) {
    for (const member of this.memberList) {
      if (member.username == playerUsername) {
        io.to(member.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "You cannot speak at night.",
        );
      }
    }
  }

  /**
   * Sends a message to all members of the Lawman faction.
   *
   * @param {string} message - The message to send to all Lawman members
   * @returns {void}
   */
  sendMessage(message: string) {
    for (const member of this.memberList) {
      io.to(member.user.socketId).emit(ServerEvent.ReceiveMessage, message);
    }
  }

  /**
   * Removes deceased or converted members from the Lawman faction member list.
   * A member is kept only if they are alive and still have the Lawman role.
   *
   * @returns {void}
   */
  removeMembers() {
    this.memberList = this.memberList.filter(
      (member) => member.isAlive && member.role.name == "Lawman",
    );
  }
}
