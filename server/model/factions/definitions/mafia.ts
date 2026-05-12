import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";
import type { FactionDefinition } from "../composition/factionDefinition.js";
import { RoleTrait } from "../../roles/composition/roleTraits.js";

export const mafiaFactionDefinition: FactionDefinition = {
  id: "mafia",
  name: "Mafia",
  membership: {
    includes: (player) => player.role.hasTrait(RoleTrait.MafiaFactionMember),
  },
  chatPolicy: {
    handleNightMessage: ({ faction }, message, playerUsername) => {
      const nightMessage = `${playerUsername}: ${message}`;
      for (const member of faction.memberList) {
        io.to(member.user.socketId).emit(ServerEvent.ReceiveChatMessage, nightMessage);
      }
    },
  },
  votePolicy: {
    resolveVotes: ({ faction }) => {
      const attackList = faction.memberList
        .map((member) => member.role.attackVote)
        .filter((vote): vote is NonNullable<typeof vote> => vote !== null && vote !== undefined);
      for (const member of faction.memberList) {
        member.role.attackVote = null;
      }
      if (attackList.length === 0 || faction.memberList.length === 0) return;

      const victim = attackList[Math.floor(Math.random() * attackList.length)];
      const attacker = faction.memberList[Math.floor(Math.random() * faction.memberList.length)]?.role;
      if (!attacker) return;
      attacker.visiting = victim;
      attacker.isAttacking = true;
    },
  },
  cleanupPolicy: {
    keepMember: (player, { faction }) => player.isAlive && player.role.faction === faction,
  },
};
