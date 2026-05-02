import { Player } from "../player/player.js";
import { Faction } from "./abstractFaction.js";
import { Room } from "../rooms/room.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../servers/emitter.js";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import type { GameMessage } from "@mernmafia/shared/communication/messages";

const MAX_RANDOM_VISIT_ATTEMPTS = 100;

export class LawmanFaction extends Faction {
  room?: Room;

  /**
   * Finds all Lawman players from the given list and adds them to the memberList.
   * Sets the room reference from the first found Lawman member.
   *
   * @param playerList - List of all players in the game
   * @returns
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
   * @returns
   */
  handleNightVote() {
    if (this.room === undefined) return;
    for (const member of this.memberList) {
      if (member.role.isInsane) {
        this.assignRandomVisitForInsaneMember(member);
      }
    }
  }

  private assignRandomVisitForInsaneMember(member: Player): void {
    for (let attempt = 0; attempt < MAX_RANDOM_VISIT_ATTEMPTS; attempt++) {
      const result = this.tryAssignRandomVisit(member);
      if (result) break;
    }
  }

  private tryAssignRandomVisit(member: Player): boolean {
    if (!this.room) return false;
    const randomIndex = Math.floor(Math.random() * this.room.playerList.length);
    const randomVictim = this.room.playerList[randomIndex];
    if (randomVictim.isAlive) {
      console.log(randomVictim.role.name);
      member.role.visiting = randomVictim.role;
      return true;
    }
    return false;
  }

  /**
   * Sends a message to the specified player indicating they cannot speak during night phase.
   * Only the named player receives this message.
   *
   * @param message - Not used; Lawman faction always sends a fixed message
   * @param playerUsername - The username of the player to notify
   * @returns
   */
  handleNightMessage(message: string, playerUsername: string) {
    for (const member of this.memberList) {
      if (member.username == playerUsername) {
        io.to(member.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.CannotSpeakAtNight,
        });
      }
    }
  }

  /**
   * Sends a message to all members of the Lawman faction.
   *
   * @param message - The message to send to all Lawman members
   * @returns
   */
  sendMessage(message: GameMessage) {
    for (const member of this.memberList) {
      io.to(member.user.socketId).emit(ServerEvent.ReceiveMessage, message);
    }
  }

  /**
   * Removes deceased or converted members from the Lawman faction member list.
   * A member is kept only if they are alive and still have the Lawman role.
   *
   * @returns
   */
  removeMembers() {
    this.memberList = this.memberList.filter(
      (member) => member.isAlive && member.role.name == "Lawman",
    );
  }
}
