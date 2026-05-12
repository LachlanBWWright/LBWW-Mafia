import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";
import { CombatLevel } from "../combatLevel.js";
import { RoleGroup } from "../roleGroup.js";
import { GamePhase } from "../../rooms/gamePhase.js";
import type { RoleDefinition } from "../composition/roleDefinition.js";
import { RoleTrait } from "../composition/roleTraits.js";
import { chooseDayOther, chooseNightOther, roleblockVisit } from "./helpers.js";

const townTraits = [RoleTrait.TownAligned];

export const doctorDefinition: RoleDefinition = {
  kind: "built-in",
  id: "doctor",
  metadata: {
    name: "Doctor",
    group: RoleGroup.Town,
    category: "town-support",
    summary: "Heals another player at night.",
    description: "Choose one living non-self player at night and raise their defence.",
    isUnique: false,
  },
  balance: { power: 5 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false,
    nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.DoctorCannotHealSelf, MessageKey.DoctorChoseToHeal) },
    {
      onNightVisit: ({ role }) => {
        if (role.visiting === null) return;
        if (role.visiting.defence === CombatLevel.None) role.visiting.defence = CombatLevel.Low;
        role.visiting.receiveVisit(role);
      },
    },
  ],
};

export const investigatorDefinition: RoleDefinition = {
  kind: "built-in",
  id: "investigator",
  metadata: {
    name: "Investigator", group: RoleGroup.Town, category: "town-investigative",
    summary: "Inspects another player.", description: "Gets 3 possible roles with imperfect accuracy.", isUnique: false,
  },
  balance: { power: 4 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false, nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false, nightVote: false },
  traits: townTraits,
  handlers: [
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.CannotInspectSelf, MessageKey.ChoseToInspect) },
    {
      onNightVisit: ({ role }) => {
        if (role.visiting === null) return;
        role.visiting.receiveVisit(role);
        const guesses: string[] = [];
        for (let i = 0; i < 3; i++) {
          if (Math.random() < 0.3) {
            guesses.push(role.visiting.name);
          } else {
            const randomPlayer = role.room.playerList[Math.floor(Math.random() * role.room.playerList.length)];
            guesses.push(randomPlayer.role.name);
          }
        }
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.InvestigatorResult,
          params: {
            targetName: role.visiting.player.username,
            role1: guesses[0] ?? "",
            role2: guesses[1] ?? "",
            role3: guesses[2] ?? "",
          },
        });
      },
    },
  ],
};

export const judgeDefinition: RoleDefinition = {
  kind: "built-in",
  id: "judge",
  metadata: { name: "Judge", group: RoleGroup.Town, category: "town-investigative", summary: "Checks alignment.", description: "Reports role group, sometimes false.", isUnique: false },
  balance: { power: 6 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false, nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false, nightVote: false },
  traits: townTraits,
  handlers: [
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.JudgeCannotInspectSelf, MessageKey.ChoseToInspect) },
    {
      onNightVisit: ({ role }) => {
        if (role.visiting === null) return;
        role.visiting.receiveVisit(role);
        let factionName = role.visiting.group;
        if (Math.random() < 0.3) {
          const living = role.room.playerList.filter((player) => player.isAlive);
          factionName = living[Math.floor(Math.random() * living.length)]?.role.group ?? factionName;
        }
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.JudgeAlignmentResult,
          params: { targetName: role.visiting.player.username, factionName },
        });
      },
    },
  ],
};

export const watchmanDefinition: RoleDefinition = {
  kind: "built-in",
  id: "watchman",
  metadata: { name: "Watchman", group: RoleGroup.Town, category: "town-investigative", summary: "Observes visitors.", description: "Sees who visited target at night.", isUnique: false },
  balance: { power: 4 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false, nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false, nightVote: false },
  traits: townTraits,
  handlers: [
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.WatchmanCannotWatchSelf, MessageKey.WatchmanChoseToWatch) },
    { onNightVisit: ({ role }) => role.visiting?.receiveVisit(role) },
    {
      onVisitOutcomes: ({ role }) => {
        if (role.visiting === null) return;
        const target = role.visiting;
        const visitorCount = target.visitors.length;
        if (visitorCount === 1) {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.WatchmanNobodyVisited });
          return;
        }
        if (visitorCount === 2) {
          const realVisitor = target.visitors[0] === role ? target.visitors[1] : target.visitors[0];
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
            key: MessageKey.WatchmanTargetVisitedBy,
            params: { targetName: realVisitor?.player.username ?? "" },
          });
          return;
        }
        const visitorList = target.visitors.filter((visitor) => visitor.player.isAlive && visitor !== role).map((visitor) => visitor.player.username);
        const lastEntry = visitorList[visitorList.length - 1] ?? "";
        const list = visitorList.length > 1 ? `${visitorList.slice(0, -1).join(", ")}, and ${lastEntry}` : lastEntry;
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.WatchmanVisitorList, params: { list } });
      },
    },
  ],
};

export const trackerDefinition: RoleDefinition = {
  kind: "built-in",
  id: "tracker",
  metadata: { name: "Tracker", group: RoleGroup.Town, category: "town-investigative", summary: "Tracks movement.", description: "Sees who target visited.", isUnique: false },
  balance: { power: 5 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false, nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false, nightVote: false },
  traits: townTraits,
  handlers: [
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.TrackerCannotTrackSelf, MessageKey.TrackerChoseToTrack) },
    { onNightVisit: ({ role }) => role.visiting?.receiveVisit(role) },
    {
      onVisitOutcomes: ({ role }) => {
        if (role.visiting?.visiting) {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
            key: MessageKey.TrackerTargetVisited,
            params: { targetName: role.visiting.visiting.player.username },
          });
        } else {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.TrackerTargetDidNotVisit });
        }
      },
    },
  ],
};

export const tapperDefinition: RoleDefinition = {
  kind: "built-in",
  id: "tapper",
  metadata: { name: "Tapper", group: RoleGroup.Town, category: "town-support", summary: "Wiretaps day or night.", description: "Can tap whispers and night chat.", isUnique: false },
  balance: { power: 3 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: true, dayVisitFaction: false, nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false, nightVote: false },
  traits: townTraits,
  handlers: [
    { onDayCommand: ({ role, recipient }) => chooseDayOther(role, recipient, MessageKey.CannotTapSelf, MessageKey.ChoseToTap) },
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.CannotTapSelf, MessageKey.ChoseToTap) },
    {
      onDayVisit: ({ role }) => {
        if (role.dayVisiting === null) return;
        io.to(role.dayVisiting.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.YouHaveBeenWiretapped });
        role.dayVisiting.nightTapped = role;
      },
      onNightVisit: ({ role }) => {
        if (role.visiting === null) return;
        role.visiting.receiveVisit(role);
        role.visiting.dayTapped = role;
      },
    },
  ],
};

export const roleblockerDefinition: RoleDefinition = {
  kind: "built-in",
  id: "roleblocker",
  metadata: { name: "Roleblocker", group: RoleGroup.Town, category: "town-support", summary: "Blocks night action.", description: "Roleblocks target with conversion chance against non-town.", isUnique: false },
  balance: { power: 5 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false, nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false, nightVote: false },
  traits: [...townTraits, RoleTrait.Roleblocker],
  handlers: [{ onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.CannotBlockSelf, MessageKey.ChoseToBlock) }, roleblockVisit(false)],
};

export const bodyguardDefinition: RoleDefinition = {
  kind: "built-in",
  id: "bodyguard",
  metadata: { name: "Bodyguard", group: RoleGroup.Town, category: "town-protective", summary: "Protects and retaliates.", description: "Protects target and hurts attackers.", isUnique: false },
  balance: { power: 6 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false, nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false, nightVote: false },
  traits: townTraits,
  handlers: [
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.CannotProtectSelf, MessageKey.ChoseToProtect) },
    {
      onNightVisit: ({ role }) => {
        if (role.visiting === null) return;
        if (role.visiting.defence === CombatLevel.None) role.visiting.defence = CombatLevel.Low;
        role.visiting.receiveVisit(role);
      },
      onVisitOutcomes: ({ role }) => {
        if (role.visiting === null) return;
        for (const visitor of role.visiting.visitors) {
          if (visitor === role || visitor === role.visiting) continue;
          if (visitor.damage === CombatLevel.None) visitor.damage = CombatLevel.Low;
          visitor.attackers.push(role);
        }
      },
    },
  ],
};

export const nimbyDefinition: RoleDefinition = {
  kind: "built-in",
  id: "nimby",
  metadata: { name: "Nimby", group: RoleGroup.Town, category: "town-protective", summary: "Self alert mode.", description: "Alerts consume charges and retaliate visitors.", isUnique: false },
  balance: { power: 5 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false, nightVisitSelf: true, nightVisitOthers: false, nightVisitFaction: false, nightVote: false },
  traits: townTraits,
  handlers: [
    {
      onAttach: ({ role }) => {
        role.state.custom.nimby = { alertSlots: 3 };
      },
    },
    {
      onNightCommand: ({ role }) => {
        const alertSlots = role.state.custom.nimby?.alertSlots ?? 0;
        if (alertSlots === 0) {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.NimbyNoAlerts });
          return true;
        }
        if (role.visiting === null) {
          role.visiting = role;
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.NimbyDecidedAlert });
        } else {
          role.visiting = null;
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.NimbyDecidedNotAlert });
        }
        return true;
      },
      onNightVisit: ({ role }) => {
        if (role.visiting === null) return;
        if (role.defence === CombatLevel.None) {
          role.defence = CombatLevel.Low;
          const currentSlots = role.state.custom.nimby?.alertSlots ?? 0;
          role.state.custom.nimby = { alertSlots: Math.max(0, currentSlots - 1) };
        }
        role.receiveVisit(role);
      },
      onVisitOutcomes: ({ role }) => {
        if (role.visiting === null) return;
        for (const visitor of role.visitors) {
          if (visitor === role) continue;
          if (visitor.damage === CombatLevel.None) visitor.damage = CombatLevel.Low;
        }
      },
    },
  ],
};

export const sacrificerDefinition: RoleDefinition = {
  kind: "built-in",
  id: "sacrificer",
  metadata: { name: "Sacrificer", group: RoleGroup.Town, category: "town-protective", summary: "Sacrifices self to save target.", description: "If target is attacked, dies and reveals attackers.", isUnique: false },
  balance: { power: 8 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false, nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false, nightVote: false },
  traits: townTraits,
  handlers: [
    { onNightCommand: ({ role, recipient }) => chooseNightOther(role, recipient, MessageKey.CannotProtectSelf, MessageKey.ChoseToProtect) },
    { onNightVisit: ({ role }) => role.visiting?.receiveVisit(role) },
    {
      onVisitOutcomes: ({ role }) => {
        if (role.visiting === null || role.visiting.attackers.length === 0) return;
        role.visiting.defence = CombatLevel.High;
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.SacrificerDied });
        io.to(role.visiting.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.TargetSavedBySacricer });
        role.damage = CombatLevel.Critical;
        for (const attacker of role.visiting.attackers) {
          io.to(role.visiting.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
            key: MessageKey.AttackedByWithRole,
            params: { playerName: attacker.player.username, roleName: attacker.name },
          });
        }
      },
    },
  ],
};

export const fortifierDefinition: RoleDefinition = {
  kind: "built-in",
  id: "fortifier",
  metadata: { name: "Fortifier", group: RoleGroup.Town, category: "town-protective", summary: "Applies persistent fortification.", description: "Fortifies a house, then may strip with fatal risk.", isUnique: false },
  balance: { power: 8 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false, nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false, nightVote: false },
  traits: townTraits,
  handlers: [
    {
      onAttach: ({ role }) => {
        role.state.custom.fortifier = {
          canFortify: true,
          playerFortified: null,
        };
      },
    },
    {
      onNightCommand: ({ role, recipient }) => {
        if (recipient === role.player) {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.FortifierCannotFortifySelf });
          return true;
        }
        const fortifierState = role.state.custom.fortifier;
        const canFortify = fortifierState?.canFortify ?? true;
        const playerFortified = fortifierState?.playerFortified ?? null;
        if (recipient.isAlive && canFortify) {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
            key: MessageKey.FortifierChoseToFortify,
            params: { targetName: recipient.username },
          });
          role.visiting = recipient.role;
          return true;
        }
        if (playerFortified && playerFortified.player.isAlive && !canFortify) {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
            key: MessageKey.FortifierChoseToRemove,
            params: { targetName: playerFortified.player.username },
          });
          role.visiting = recipient.role;
          return true;
        }
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: playerFortified ? MessageKey.FortifierCannotRemoveDead : MessageKey.InvalidChoice,
        });
        return true;
      },
      onNightVisit: ({ role }) => {
        if (role.visiting === null) return;
        role.visiting.receiveVisit(role);
        const fortifierState = role.state.custom.fortifier;
        const canFortify = fortifierState?.canFortify ?? true;
        const fortified = fortifierState?.playerFortified ?? null;
        if (canFortify) {
          role.state.custom.fortifier = {
            canFortify: false,
            playerFortified: role.visiting,
          };
          role.visiting.baseDefence += CombatLevel.Medium;
          io.to(role.visiting.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.FortifierHouseFortified });
          return;
        }
        if (!fortified) return;
        role.visiting.baseDefence -= CombatLevel.Medium;
        if (Math.random() > 0.5) {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.FortifierDiedStripping });
          io.to(fortified.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
            key: MessageKey.FortifierOwnerDiedStripping,
            params: { playerName: fortified.player.username },
          });
          role.damage = CombatLevel.Fatal;
        } else {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.FortifierStrippedKilledOwner });
          io.to(fortified.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.FortifierTargetDied });
          fortified.damage = CombatLevel.Fatal;
        }
      },
      onVisitOutcomes: ({ role }) => {
        const fortified = role.state.custom.fortifier?.playerFortified ?? null;
        if (!fortified || role.visiting === null) return;
        for (const attacker of role.visiting.attackers) {
          if (attacker !== role && attacker !== role.visiting) {
            if (attacker.damage === CombatLevel.None) attacker.damage = CombatLevel.Low;
            attacker.attackers.push(role);
          }
        }
      },
    },
  ],
};

export const jailorDefinition: RoleDefinition = {
  kind: "built-in",
  id: "jailor",
  metadata: { name: "Jailor", group: RoleGroup.Town, category: "town-killing", summary: "Jails by day, can execute by night.", description: "Private night chat with jailed target.", isUnique: true },
  balance: { power: 12 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: true, dayVisitFaction: false, nightVisitSelf: true, nightVisitOthers: false, nightVisitFaction: false, nightVote: false },
  traits: [...townTraits, RoleTrait.Unique],
  handlers: [
    {
      onHandleMessage: ({ role, message }) => {
        if (role.room.time === GamePhase.Day) return false;
        if (role.dayVisiting === null) return false;
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveChatMessage, `Jailor: ${message}`);
        io.to(role.dayVisiting.player.user.socketId).emit(ServerEvent.ReceiveChatMessage, `Jailor: ${message}`);
        return true;
      },
      onDayCommand: ({ role, recipient }) => chooseDayOther(role, recipient, MessageKey.JailorCannotJailSelf, MessageKey.JailorChoseToJail),
      onNightCommand: ({ role }) => {
        if (role.dayVisiting === null) {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.JailorNoJailed });
          return true;
        }
        if (role.visiting === null) {
          role.visiting = role.dayVisiting;
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.JailorDecidedToExecute });
          io.to(role.dayVisiting.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.JailedWillBeExecuted });
        } else {
          role.visiting = null;
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.JailorDecidedNotToExecute });
          io.to(role.dayVisiting.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.JailedWillNotBeExecuted });
        }
        return true;
      },
      onDayVisit: ({ role }) => {
        if (role.dayVisiting === null) return;
        io.to(role.dayVisiting.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.YouHaveBeenJailed });
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.JailorJailedTarget });
        role.dayVisiting.jailed = role;
        role.dayVisiting.roleblocked = true;
      },
      onNightVisit: ({ role }) => {
        if (role.visiting === null) return;
        role.visiting.receiveVisit(role);
        if (role.visiting.damage < CombatLevel.High) role.visiting.damage = CombatLevel.High;
        role.visiting.attackers.push(role);
      },
      onVisitOutcomes: ({ role }) => {
        if (role.dayVisiting === null) return;
        role.dayVisiting.jailed = null;
        if (role.dayVisiting.baseDefence === CombatLevel.None) {
          role.dayVisiting.defence = CombatLevel.Low;
        }
      },
    },
  ],
};

export const lawmanDefinition: RoleDefinition = {
  kind: "built-in",
  id: "lawman",
  metadata: { name: "Lawman", group: RoleGroup.Town, category: "town-killing", summary: "Shoots at night, can become insane.", description: "If shoots town, becomes insane and forced random visits.", isUnique: true },
  balance: { power: 8 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false, nightVisitSelf: false, nightVisitOthers: true, nightVisitFaction: false, nightVote: false },
  traits: [...townTraits, RoleTrait.LawmanFactionMember, RoleTrait.Unique],
  handlers: [
    { onAttach: ({ role }) => role.isInsane = false },
    {
      onNightCommand: ({ role, recipient }) => {
        if (role.isInsane) {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.LawmanInsane });
          return true;
        }
        return chooseNightOther(role, recipient, MessageKey.LawmanCannotShootSelf, MessageKey.ChoseToAttack);
      },
    },
    {
      onNightVisit: ({ role }) => {
        if (role.visiting === null) return;
        if (role.isInsane) {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.LawmanInsaneShooting });
        }
        if (role.visiting.damage === CombatLevel.None) role.visiting.damage = CombatLevel.Low;
        role.visiting.attackers.push(role);
        role.visiting.receiveVisit(role);
        if (role.visiting.group === RoleGroup.Town) {
          role.isInsane = true;
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.LawmanShotTownMember });
        }
      },
    },
  ],
};

export const vetterDefinition: RoleDefinition = {
  kind: "built-in",
  id: "vetter",
  metadata: { name: "Vetter", group: RoleGroup.Town, category: "town-investigative", summary: "Researches two random players.", description: "Limited self-use research sessions.", isUnique: false },
  balance: { power: 4 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: { dayVisitSelf: false, dayVisitOthers: false, dayVisitFaction: false, nightVisitSelf: true, nightVisitOthers: false, nightVisitFaction: false, nightVote: false },
  traits: townTraits,
  handlers: [
    {
      onAttach: ({ role }) => {
        role.state.custom.vetter = { researchSlots: 3 };
      },
    },
    {
      onNightCommand: ({ role }) => {
        const slots = role.state.custom.vetter?.researchSlots ?? 0;
        if (slots === 0) {
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.VetterNoSessions });
          return true;
        }
        if (role.visiting === null) {
          role.visiting = role;
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.VetterDecidedToResearch });
        } else {
          role.visiting = null;
          io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.VetterDecidedNotToResearch });
        }
        return true;
      },
      onNightVisit: ({ role }) => {
        if (role.visiting === null) return;
        role.visiting.receiveVisit(role);
        const slots = role.state.custom.vetter?.researchSlots ?? 0;
        role.state.custom.vetter = {
          researchSlots: Math.max(0, slots - 1),
        };

        const p1 = Math.floor(Math.random() * role.room.playerList.length);
        let p2 = p1;
        while (p2 === p1 && role.room.playerList.length > 1) {
          p2 = Math.floor(Math.random() * role.room.playerList.length);
        }
        const reported = Math.random() > 0.5 ? p1 : p2;
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.VetterResearchResult,
          params: {
            name1: role.room.playerList[p1]?.username ?? "",
            name2: role.room.playerList[p2]?.username ?? "",
            roleName: role.room.playerList[reported]?.role.name ?? "",
          },
        });
        io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.VetterSessionsLeft,
          params: { count: role.state.custom.vetter?.researchSlots ?? 0 },
        });
      },
    },
  ],
};
