import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../servers/emitter.js";
import { Player } from "../player/player.js";
import type { GameMessage } from "@mernmafia/shared/communication/messages";
import type { Role } from "../roles/abstractRole.js";
import type { FactionNightActionIntent } from "./nightIntent.js";

export abstract class Faction {
  memberList: Player[] = [];

  /**
   * Initializes all members of this faction by assigning the faction to each member's role
   * and broadcasting their role information to all faction members.
   *
   * @returns
   */
  initializeMembers() {
    for (const member of this.memberList) {
      member.role.assignFaction(this);
      this.broadcastMemberRole(member);
    }
  }

  private broadcastMemberRole(member: Player): void {
    for (const targetMember of this.memberList) {
      io.to(targetMember.user.socketId).emit(ServerEvent.UpdateFactionRole, {
        name: member.username,
        role: member.role.name,
      });
    }
  }

  /**
   * Finds all members of this faction from the given player list and adds them to memberList.
   * Must be implemented by subclasses to identify which players belong to this faction.
   *
   * @param playerList - List of all players in the game
   * @returns
   * @abstract
   */
  abstract findMembers(playerList: Player[]): void;

  /**
   * Sends a message to all members of this faction.
   * Must be implemented by subclasses to determine how messages are delivered.
   *
   * @param message - The message to send to faction members
   * @returns
   * @abstract
   */
  abstract sendMessage(message: GameMessage): void;

  /**
   * Handles factional decisions during the night phase, such as coordinating votes.
   * Must be implemented by subclasses to define faction-specific behavior.
   *
   * @returns
   * @abstract
   */
  abstract handleNightVote(): void;

  /**
   * Handles night chat messages from a faction member.
   * Must be implemented by subclasses to handle faction-specific message routing.
   *
   * @param message - The chat message
   * @param playerUsername - The username of the player sending the message
   * @returns
   * @abstract
   */
  abstract handleNightMessage(message: string, playerUsername: string): void;

  /**
   * Removes members from this faction if they have died or been converted to another faction.
   * Must be implemented by subclasses to define faction-specific removal logic.
   *
   * @returns
   * @abstract
   */
  abstract removeMembers(): void;

  drainNightIntents(): FactionNightActionIntent[] {
    return [];
  }

  recordNightVote(_actor: Role, _target: Role | null): void {}

  readNightVotes(): Role[] {
    return [];
  }

  clearNightVotes(): void {}
}
