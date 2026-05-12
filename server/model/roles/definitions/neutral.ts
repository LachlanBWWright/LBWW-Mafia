import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";
import { CombatLevel } from "../combatLevel.js";
import { RoleGroup } from "../roleGroup.js";
import type { RoleDefinition } from "../composition/roleDefinition.js";
import { RoleTrait } from "../composition/roleTraits.js";
import { chooseNightOther, roleblockVisit, simpleAttack } from "./helpers.js";

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
  handlers: [
    {
      onAttach: ({ role }) => {
        role.state.custom.sniper = { lastVisited: null };
      },
    },
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.SniperCannotSnipeSelf, MessageKey.SniperChoseToSnipe) },
    { onNightVisit: ({ role }) => role.visiting?.receiveVisit(role) },
    {
      onVisitOutcomes: ({ role }) => {
        if (role.visiting === null) return;
        const lastVisited = role.state.custom.sniper?.lastVisited ?? null;
        if (role.visiting.visiting === role.visiting || role.visiting.visiting === null) {
          if (role.visiting.damage < CombatLevel.High) role.visiting.damage = CombatLevel.High;
        } else if (lastVisited === role.visiting && role.visiting.damage === CombatLevel.None) {
          role.visiting.damage = CombatLevel.Low;
        }
        role.state.custom.sniper = { lastVisited: role.visiting };
      },
    },
  ],
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
        const target = role.room.playerList.find(
          (candidate) => candidate.isAlive && candidate.role.group === RoleGroup.Town,
        );
        if (!target) return;
        role.state.custom.framer = { target: target.role };
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.FramerTarget,
          params: { targetName: target.username },
        });
      },
      onDayUpdate: ({ role }) => {
        const target = role.state.custom.framer?.target ?? null;
        if (role.victoryCondition || !target || target.player.isAlive) return;
        const next = role.room.playerList.find(
          (candidate) => candidate.isAlive && candidate.role.group === RoleGroup.Town,
        );
        if (!next) return;
        role.state.custom.framer = { target: next.role };
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.FramerNewTarget,
          params: { targetName: next.username },
        });
      },
      onPlayerVotedOut: ({ role, votedOut }) => {
        const target = role.state.custom.framer?.target ?? null;
        if (target === votedOut) {
          role.victoryCondition = true;
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
            key: MessageKey.FramerTargetVotedOut,
          });
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
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.PeacemakerWon,
        });
      },
    },
  ],
};
