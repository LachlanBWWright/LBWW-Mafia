import { Faction } from "./abstractFaction.js";
import { Player } from "../player/player.js";
import { Role } from "../roles/abstractRole.js";
import { type Room } from "../rooms/room.js";
import { RoleGroup } from "../../../shared/roles/roleEnums.js";

import type { RoleMafia } from "../roles/mafia/abstractMafiaRole.js";

export class MafiaFaction extends Faction {
  // Members are players whose `role` is `RoleMafia` (mafia-specific role behavior available)
  memberList: (Player & { role: RoleMafia })[] = [];
  attackList: Role[] = [];
  room?: Room;

  findMembers(playerList: Player[]) {
    //Go through a list of members, add them to the this.memberList
    for (const player of playerList) {
      if (player.role.group === RoleGroup.Mafia) {
        this.memberList.push(player);
      }
    }

    this.initializeMembers(); //Then adds this faction to each relevant member's object
  }

  handleNightVote() {
    for (const member of this.memberList) {
      const role = member.role;
      const attackVote = role.attackVote;

      if (attackVote instanceof Role) {
        // Direct Role vote
        this.attackList.push(attackVote);
      } else if (attackVote instanceof Player && attackVote.role) {
        // Player vote: use their assigned role
        this.attackList.push(attackVote.role);
      }

      // reset
      role.attackVote = null;
    }
    if (this.attackList.length != 0) {
      const victim =
        this.attackList[Math.floor(Math.random() * this.attackList.length)]; //Selects a random item in the list, and uses that.
      const attackerMember =
        this.memberList[Math.floor(Math.random() * this.memberList.length)];
      if (!attackerMember || !victim) return;
      const attacker = attackerMember.role;
      attacker.visiting = victim;
      Object.assign(attacker, { isAttacking: true });
    }
    this.attackList = [];
  }

  handleNightMessage(message: string, playerUsername: string) {
    // Mafia only chat
    const nightMessage = playerUsername + ": " + message;
    if (!this.room) return;
    // Sends the message to every member of the faction.
    for (const member of this.memberList) {
      this.room.socketHandler.sendPlayerMessage(member.socketId, {
        name: "receive-chat-message",
        data: { message: nightMessage },
      });
    }
  }

  sendMessage(message: string) {
    if (!this.room) return;
    for (const member of this.memberList) {
      this.room.socketHandler.sendPlayerMessage(member.socketId, {
        name: "receiveMessage",
        data: { message },
      });
    }
  }

  //For overriding a class' visiting behaviour
  visit(role: Role) {
    if (role.visiting != null) {
      role.visiting.receiveVisit(role);
      if (role.visiting.damage == 0) role.visiting.damage = 1; //Attacks the victim
      role.visiting.attackers.push(role);
    }
  }

  removeMembers() {
    let i = 0;
    for (const member of this.memberList) {
      if (!member.isAlive || member.role.group !== RoleGroup.Mafia) {
        this.memberList.splice(i, 1);
        i--;
      }
      i++;
    }
  }
}
