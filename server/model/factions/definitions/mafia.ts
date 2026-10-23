import { ServerEvent } from "@mernmafia/shared/communication/events";
import type { FactionDefinition } from "../composition/factionDefinition.js";
import { RoleTrait } from "../../roles/composition/roleTraits.js";
import { CombatLevel } from "../../roles/combatLevel.js";

export const mafiaFactionDefinition: FactionDefinition = {
  id: "mafia",
  name: "Mafia",
  memberTraits: [RoleTrait.MafiaFactionMember],
  membership: {
    includes: (player) => player.role.hasTrait(RoleTrait.MafiaFactionMember),
  },
  chatPolicy: {
    handleNightMessage: ({ faction }, message, playerUsername) => {
      const nightMessage = `${playerUsername}: ${message}`;
      faction.sendNotice(ServerEvent.ReceiveChatMessage, nightMessage);
    },
  },
  votePolicy: {
    resolveVotes: ({ faction, room }) => {
      const attackList = faction.readNightVotes();
      faction.clearNightVotes();
      if (attackList.length === 0 || faction.memberList.length === 0) return [];

      const victim = attackList[room.randomIndex(attackList.length)];
      const attacker = faction.memberList[room.randomIndex(faction.memberList.length)]?.role;
      if (!victim || !attacker) return [];
      return [
        {
          kind: "attack",
          actor: attacker,
          target: victim,
          damage: CombatLevel.Low,
        },
      ];
    },
  },
  cleanupPolicy: {
    keepMember: (player, { faction }) => player.isAlive && player.role.faction === faction,
  },
};
