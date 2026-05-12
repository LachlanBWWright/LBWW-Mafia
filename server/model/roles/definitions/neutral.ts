import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../combatLevel.js";
import { RoleGroup } from "../roleGroup.js";
import type { RoleDefinition } from "../composition/roleDefinition.js";
import { RoleTrait } from "../composition/roleTraits.js";
import type { RoleInstance } from "../composition/roleInstance.js";
import { chooseNightOther } from "../composition/handlers/targeting.js";
import {
  applyDamageMinimum,
  registerNightVisit,
  roleblockVisit,
  simpleAttack,
} from "../composition/handlers/effects.js";
import {
  actorNotice,
  dispatchNotice,
} from "../composition/handlers/notices.js";

const SNIPER_LAST_VISITED_SLOT = "sniper-last-visited";
const FRAMER_TARGET_SLOT = "framer-current-target";

function findLivingTownTarget(role: RoleInstance) {
  return role.room.playerList.find(
    (candidate) => candidate.isAlive && candidate.role.group === RoleGroup.Town,
  );
}

export const blankRoleDefinition: RoleDefinition = {
  kind: "built-in",
  id: "blank-role",
  metadata: {
    name: "Blank Role",
    group: RoleGroup.Unaligned,
    category: "system",
    summary: "Placeholder role.",
    description: "No actions.",
    isUnique: false,
  },
  balance: { power: 0 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false,
    nightVisitSelf: false, nightVisitOthers: false, nightVisitFaction: false,
    nightVote: false,
  },
  traits: [],
  handlers: [],
};

export const maniacDefinition: RoleDefinition = {
  kind: "built-in",
  id: "maniac",
  metadata: {
    name: "Maniac",
    group: RoleGroup.Maniac,
    category: "neutral-killing",
    summary: "Neutral attacker.",
    description: "Attacks one target each night.",
    isUnique: true,
  },
  balance: { power: -12 },
  combat: { baseDefence: CombatLevel.Low },
  capabilities: {
    dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false,
    nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false,
    nightVote: false,
  },
  traits: [RoleTrait.NeutralAligned, RoleTrait.Unique],
  handlers: [
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.ManiacCannotAttackSelf, MessageKey.ChoseToAttack) },
    simpleAttack(CombatLevel.Low),
  ],
};

export const sniperDefinition: RoleDefinition = {
  kind: "built-in",
  id: "sniper",
  metadata: {
    name: "Sniper",
    group: RoleGroup.Sniper,
    category: "neutral-killing",
    summary: "High burst attacker.",
    description: "Damage depends on target movement.",
    isUnique: true,
  },
  balance: { power: -10 },
  combat: { baseDefence: CombatLevel.Low },
  capabilities: {
    dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false,
    nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false,
    nightVote: false,
  },
  traits: [RoleTrait.NeutralAligned, RoleTrait.Unique],
  handlers: () => {
    return [
      { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.SniperCannotSnipeSelf, MessageKey.SniperChoseToSnipe) },
      { onNightVisit: ({ role }) => void registerNightVisit(role) },
      {
        onVisitOutcomes: ({ role }) => {
          const target = role.visiting;
          if (target === null) return;
          const lastVisited = role.getPersistentTarget(SNIPER_LAST_VISITED_SLOT);
          if (target.visiting === target || target.visiting === null) {
            applyDamageMinimum(target, CombatLevel.High);
          } else if (lastVisited === target && target.damage === CombatLevel.None) {
            target.damage = CombatLevel.Low;
          }
          role.setPersistentTarget(SNIPER_LAST_VISITED_SLOT, target);
        },
      },
    ];
  },
};

export const framerDefinition: RoleDefinition = {
  kind: "built-in",
  id: "framer",
  metadata: {
    name: "Framer",
    group: RoleGroup.Neutral,
    category: "neutral-chaos",
    summary: "Wins when marked town target is voted out.",
    description: "Gets and refreshes a random living town target.",
    isUnique: true,
  },
  balance: { power: -5 },
  combat: { baseDefence: CombatLevel.Low },
  capabilities: {
    dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false,
    nightVisitSelf: false, nightVisitOthers: false, nightVisitFaction: false,
    nightVote: false,
  },
  traits: [RoleTrait.NeutralAligned, RoleTrait.Unique, RoleTrait.Framer],
  handlers: [
    {
      onInit: ({ role }) => {
        const target = findLivingTownTarget(role);
        if (!target) return;
        role.setPersistentTarget(FRAMER_TARGET_SLOT, target.role);
        dispatchNotice(
          role,
          actorNotice({
            key: MessageKey.FramerTarget,
            params: { targetName: target.username },
          }),
        );
      },
      onDayUpdate: ({ role }) => {
        const targetRole = role.getPersistentTarget(FRAMER_TARGET_SLOT);
        if (role.victoryCondition || !targetRole || targetRole.player.isAlive) return;
        const next = findLivingTownTarget(role);
        if (!next) return;
        role.setPersistentTarget(FRAMER_TARGET_SLOT, next.role);
        dispatchNotice(
          role,
          actorNotice({
            key: MessageKey.FramerNewTarget,
            params: { targetName: next.username },
          }),
        );
      },
      onPlayerVotedOut: ({ role, votedOut }) => {
        if (role.getPersistentTarget(FRAMER_TARGET_SLOT) === votedOut) {
          role.victoryCondition = true;
          dispatchNotice(role, actorNotice({ key: MessageKey.FramerTargetVotedOut }));
        }
      },
    },
  ],
};

export const confesserDefinition: RoleDefinition = {
  kind: "built-in",
  id: "confesser",
  metadata: {
    name: "Confesser",
    group: RoleGroup.Neutral,
    category: "neutral-chaos",
    summary: "Wins when voted out.",
    description: "When voted out, disables further day voting.",
    isUnique: true,
  },
  balance: { power: -5 },
  combat: { baseDefence: CombatLevel.Low },
  capabilities: {
    dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false,
    nightVisitSelf: false, nightVisitOthers: false, nightVisitFaction: false,
    nightVote: false,
  },
  traits: [RoleTrait.NeutralAligned, RoleTrait.Unique, RoleTrait.Confesser],
  handlers: [],
};

export const peacemakerDefinition: RoleDefinition = {
  kind: "built-in",
  id: "peacemaker",
  metadata: {
    name: "Peacemaker",
    group: RoleGroup.Neutral,
    category: "neutral-chaos",
    summary: "Roleblocks and wants draw ending.",
    description: "Wins if the game ends with nobody dying.",
    isUnique: true,
  },
  balance: { power: -2 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false,
    nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false,
    nightVote: false,
  },
  traits: [RoleTrait.NeutralAligned, RoleTrait.Unique, RoleTrait.Peacemaker, RoleTrait.Roleblocker],
  handlers: [
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.CannotBlockSelf, MessageKey.ChoseToBlock) },
    roleblockVisit(true),
    {
      onNoDeathDraw: ({ role }) => {
        role.victoryCondition = true;
        dispatchNotice(role, actorNotice({ key: MessageKey.PeacemakerWon }));
      },
    },
  ],
};
