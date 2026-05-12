import { MessageKey } from "@mernmafia/shared/communication/messages";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import type { FactionDefinition } from "../composition/factionDefinition.js";
import { RoleTrait } from "../../roles/composition/roleTraits.js";

const MAX_RANDOM_VISIT_ATTEMPTS = 100;

export const lawmanFactionDefinition: FactionDefinition = {
  id: "lawman",
  name: "Lawman",
  memberTraits: [RoleTrait.LawmanFactionMember],
  membership: {
    includes: (player) => player.role.hasTrait(RoleTrait.LawmanFactionMember),
  },
  chatPolicy: {
    handleNightMessage: ({ faction }, _message, playerUsername) => {
      const member = faction.memberList.find((candidate) => candidate.username === playerUsername);
      if (!member) return;
      faction.sendPlayerNotice(member, ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotSpeakAtNight,
      });
    },
  },
  votePolicy: {
    resolveVotes: ({ faction, room }) => {
      const intents = [];
      if (room.playerList.length === 0) {
        return intents;
      }
      for (const member of faction.memberList) {
        if (!member.role.isInsane) continue;
        for (let attempt = 0; attempt < MAX_RANDOM_VISIT_ATTEMPTS; attempt++) {
          const randomIndex = room.randomIndex(room.playerList.length);
          const randomVictim = room.playerList[randomIndex];
          if (!randomVictim?.isAlive) continue;
          intents.push({
            kind: "forced-visit" as const,
            actor: member.role,
            target: randomVictim.role,
          });
          break;
        }
      }
      return intents;
    },
  },
  cleanupPolicy: {
    keepMember: (player, { faction }) => player.isAlive && player.role.faction === faction,
  },
};
