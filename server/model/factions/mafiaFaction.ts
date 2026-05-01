import { RoleGroup } from "../roles/roleGroup.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../servers/emitter.js";
import { Faction } from "./abstractFaction.js";
import { Player } from "../player/player.js";
import { Role } from "../roles/abstractRole.js";
import { CombatLevel } from "../roles/combatLevel.js";
import type { GameMessage } from "@mernmafia/shared/communication/messages";

export class MafiaFaction extends Faction {
  attackList: Role[] = [];

  /**
   * Finds all Mafia members from the given player list and adds them to memberList.
   * Initializes all found members with faction information.
   *
   * @param {Player[]} playerList - List of all players in the game
   * @returns {void}
   */
  findMembers(playerList: Player[]) {
    for (const player of playerList) {
      if (player.role.group == RoleGroup.Mafia) {
        this.memberList.push(player);
      }
    }

    this.initializeMembers();
  }

  /**
   * Handles night phase voting by collecting attack votes from all members
   * and selecting a random attacker to carry out an attack on a voted target.
   * Clears the attack list after vote resolution.
   *
   * @returns {void}
   */
  handleNightVote() {
    for (const member of this.memberList) {
      const attackVote = member.role.attackVote;
      if (attackVote != null) {
        this.attackList.push(attackVote);
      }
      member.role.attackVote = null;
    }
    if (this.attackList.length != 0) {
      let victim =
        this.attackList[Math.floor(Math.random() * this.attackList.length)];
      const attacker =
        this.memberList[Math.floor(Math.random() * this.memberList.length)]
          .role;
      attacker.visiting = victim;
      attacker.isAttacking = true;
    }
    this.attackList = [];
  }

  /**
   * Sends a night chat message to all Mafia faction members, prefixed with the sender's username.
   *
   * @param {string} message - The chat message content
   * @param {string} playerUsername - The username of the player sending the message
   * @returns {void}
   */
  handleNightMessage(message: string, playerUsername: string) {
    let nightMessage = playerUsername + ": " + message;

    for (const member of this.memberList) {
      io.to(member.user.socketId).emit(
        ServerEvent.ReceiveChatMessage,
        nightMessage,
      );
    }
  }

  /**
   * Sends a message to all members of the Mafia faction.
   *
   * @param {string} message - The message to send
   * @returns {void}
   */
  sendMessage(message: GameMessage) {
    for (const member of this.memberList) {
      io.to(member.user.socketId).emit(ServerEvent.ReceiveMessage, message);
    }
  }

  /**
   * Processes a Mafia member's visit to a target role.
   * Notifies the target of the visit and inflicts 1 damage on them, registering the attacker.
   *
   * @param {Role} role - The Mafia member role that is visiting
   * @returns {void}
   */
  visit(role: Role) {
    if (role.visiting != null) {
      role.visiting.receiveVisit(role);
      if (role.visiting.damage == CombatLevel.None)
        role.visiting.damage = CombatLevel.Low;
      role.visiting.attackers.push(role);
    }
  }

  /**
   * Removes members who have died or are no longer part of the Mafia faction.
   * A member is retained only if they are alive and belong to the Mafia role group.
   *
   * @returns {void}
   */
  removeMembers() {
    this.memberList = this.memberList.filter(
      (member) => member.isAlive && member.role.group == RoleGroup.Mafia,
    );
  }
}
