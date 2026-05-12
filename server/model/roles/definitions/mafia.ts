import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";
import { CombatLevel } from "../combatLevel.js";
import { RoleGroup } from "../roleGroup.js";
import type { RoleDefinition } from "../composition/roleDefinition.js";
import { RoleTrait } from "../composition/roleTraits.js";
import { chooseNightOther, roleblockVisit } from "./helpers.js";

const mafiaTraits = [
  RoleTrait.MafiaAligned,
  RoleTrait.MafiaFactionMember,
  RoleTrait.CanBeMafiaAttacker,
];

function mafiaVoteHandler(): RoleDefinition["handlers"][number] {
  return {
    onNightVote: ({ role, recipient }) => {
      if (role.faction === undefined || !recipient.isAlive || recipient.role.faction === role.faction) {
        role.attackVote = null;
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.MafiaInvalidVote,
        });
        return true;
      }
      role.attackVote = recipient.role;
      role.faction.sendMessage({
        key: MessageKey.MafiaVotedToAttack,
        params: {
          playerName: role.player.username,
          targetName: recipient.username,
        },
      });
      return true;
    },
    onNightVisit: ({ role }) => {
      if (role.visiting === null) return;
      if (role.isAttacking) {
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.MafiaChosenAttacker,
        });
      }
      role.visiting.receiveVisit(role);
      if (role.visiting.damage === CombatLevel.None) {
        role.visiting.damage = CombatLevel.Low;
      }
      role.visiting.attackers.push(role);
      role.isAttacking = false;
    },
  };
}

export const mafiaDefinition: RoleDefinition = {
  kind: "built-in",
  id: "mafia",
  metadata: {
    name: "Mafia",
    group: RoleGroup.Mafia,
    category: "mafia-killing",
    summary: "Standard mafia member.",
    description: "Votes as faction and can be picked as attacker.",
    isUnique: false,
  },
  balance: { power: -13 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false,
    nightVisitSelf: false, nightVisitOthers: false, nightVisitFaction: false,
    nightVote: true,
  },
  traits: mafiaTraits,
  handlers: [mafiaVoteHandler()],
};

export const mafiaInvestigatorDefinition: RoleDefinition = {
  kind: "built-in",
  id: "mafia-investigator",
  metadata: {
    name: "Mafia Investigator",
    group: RoleGroup.Mafia,
    category: "mafia-support",
    summary: "Inspects targets while in mafia faction.",
    description: "Gets exact target role.",
    isUnique: false,
  },
  balance: { power: -15 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false,
    nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false,
    nightVote: true,
  },
  traits: mafiaTraits,
  handlers: [
    mafiaVoteHandler(),
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.CannotInspectSelf, MessageKey.ChoseToInspect) },
    {
      onNightVisit: ({ role }) => {
        if (!role.isAttacking && role.visiting) {
          role.visiting.receiveVisit(role);
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
            key: MessageKey.MafiaInvestigatorResult,
            params: {
              targetName: role.visiting.player.username,
              roleName: role.visiting.name,
            },
          });
        }
      },
    },
  ],
};

export const mafiaRoleblockerDefinition: RoleDefinition = {
  kind: "built-in",
  id: "mafia-roleblocker",
  metadata: {
    name: "Mafia Roleblocker",
    group: RoleGroup.Mafia,
    category: "mafia-support",
    summary: "Roleblocks while in mafia faction.",
    description: "Can roleblock and still participate in faction attack voting.",
    isUnique: false,
  },
  balance: { power: -20 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false,
    nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false,
    nightVote: true,
  },
  traits: [...mafiaTraits, RoleTrait.Roleblocker],
  handlers: [
    mafiaVoteHandler(),
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.CannotBlockSelf, MessageKey.ChoseToBlock) },
    roleblockVisit(false),
  ],
};
