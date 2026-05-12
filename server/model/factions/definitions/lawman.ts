import { MessageKey } from "@mernmafia/shared/communication/messages";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";
import type { FactionDefinition } from "../composition/factionDefinition.js";
import { RoleTrait } from "../../roles/composition/roleTraits.js";

const MAX_RANDOM_VISIT_ATTEMPTS = 100;

export const lawmanFactionDefinition: FactionDefinition = {
  id: "lawman",
  name: "Lawman",
  membership: {
    includes: (player) => player.role.hasTrait(RoleTrait.LawmanFactionMember),
  },
  chatPolicy: {
    handleNightMessage: ({ faction }, _message, playerUsername) => {
      const member = faction.memberList.find((candidate) => candidate.username === playerUsername);
      if (!member) return;
      io.to(member.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotSpeakAtNight,
      });
    },
  },
  votePolicy: {
    resolveVotes: ({ faction, room }) => {
      for (const member of faction.memberList) {
        if (!member.role.isInsane) continue;
        for (let attempt = 0; attempt < MAX_RANDOM_VISIT_ATTEMPTS; attempt++) {
          const randomIndex = Math.floor(Math.random() * room.playerList.length);
          const randomVictim = room.playerList[randomIndex];
          if (!randomVictim?.isAlive) continue;
          member.role.visiting = randomVictim.role;
          break;
        }
      }
    },
  },
  cleanupPolicy: {
    keepMember: (player, { faction }) => player.isAlive && player.role.faction === faction,
  },
};
