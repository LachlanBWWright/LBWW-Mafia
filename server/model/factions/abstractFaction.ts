import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../servers/emitter.js";
import { Player } from "../player/player.js";
import type { GameMessage } from "@mernmafia/shared/communication/messages";

export abstract class Faction {
  memberList: Player[] = [];

  /**
   * Initializes all members of this faction by assigning the faction to each member's role
   * and broadcasting their role information to all faction members.
   *
   * @returns {void}
   */
  initializeMembers() {
    for (const member of this.memberList) {
      member.role.assignFaction(this);
      for (const targetMember of this.memberList) {
        io.to(targetMember.user.socketId).emit(ServerEvent.UpdateFactionRole, {
          name: member.username,
          role: member.role.name,
        });
      }
    }
  }

  /**
   * Finds all members of this faction from the given player list and adds them to memberList.
   * Must be implemented by subclasses to identify which players belong to this faction.
   *
   * @param {Player[]} playerList - List of all players in the game
   * @returns {void}
   * @abstract
   */
  abstract findMembers(playerList: Player[]): void;

  /**
   * Sends a message to all members of this faction.
   * Must be implemented by subclasses to determine how messages are delivered.
   *
   * @param {string} message - The message to send to faction members
   * @returns {void}
   * @abstract
   */
  abstract sendMessage(message: GameMessage): void;

  /**
   * Handles factional decisions during the night phase, such as coordinating votes.
   * Must be implemented by subclasses to define faction-specific behavior.
   *
   * @returns {void}
   * @abstract
   */
  abstract handleNightVote(): void;

  /**
   * Handles night chat messages from a faction member.
   * Must be implemented by subclasses to handle faction-specific message routing.
   *
   * @param {string} message - The chat message
   * @param {string} playerUsername - The username of the player sending the message
   * @returns {void}
   * @abstract
   */
  abstract handleNightMessage(message: string, playerUsername: string): void;

  /**
   * Removes members from this faction if they have died or been converted to another faction.
   * Must be implemented by subclasses to define faction-specific removal logic.
   *
   * @returns {void}
   * @abstract
   */
  abstract removeMembers(): void;
}
