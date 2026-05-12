import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../combatLevel.js";
import { RoleGroup } from "../roleGroup.js";
import type { RoleDefinition } from "../composition/roleDefinition.js";
import { RoleTrait } from "../composition/roleTraits.js";
import type { RoleHandler } from "../composition/handlers/types.js";
import { chooseNightOther } from "../composition/handlers/targeting.js";
import {
  addAttacker,
  applyDamageMinimum,
  registerNightVisit,
  roleblockVisit,
} from "../composition/handlers/effects.js";
import {
  actorNotice,
  dispatchNotice,
  factionNotice,
} from "../composition/handlers/notices.js";
import { accepted, rejected } from "../composition/handlers/results.js";

const mafiaTraits = [
  RoleTrait.MafiaAligned,
  RoleTrait.MafiaFactionMember,
  RoleTrait.CanBeMafiaAttacker,
];

function mafiaVoteHandler(): RoleHandler {
  return {
    onNightVote: ({ role, recipient }) => {
      if (
        !role.faction ||
        !recipient.isAlive ||
        recipient.role.faction === role.faction
      ) {
        role.attackVote = null;
        dispatchNotice(role, actorNotice({ key: MessageKey.MafiaInvalidVote }));
        return rejected;
      }
      role.faction.recordNightVote(role, recipient.role);
      dispatchNotice(
        role,
        factionNotice({
          key: MessageKey.MafiaVotedToAttack,
          params: {
            playerName: role.player.username,
            targetName: recipient.username,
          },
        }),
      );
      return accepted;
    },
    onNightVisit: ({ role }) => {
      const factionAction = role.consumeFactionAction("attack");
      if (!factionAction || factionAction.kind !== "attack") return;
      const target = registerNightVisit(role);
      if (!target) return;
      dispatchNotice(role, actorNotice({ key: MessageKey.MafiaChosenAttacker }));
      applyDamageMinimum(target, factionAction.damage);
      addAttacker(target, role);
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
          const target = registerNightVisit(role);
          if (!target) return;
          dispatchNotice(
            role,
            actorNotice({
              key: MessageKey.MafiaInvestigatorResult,
              params: {
                targetName: target.player.username,
                roleName: target.name,
              },
            }),
          );
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
