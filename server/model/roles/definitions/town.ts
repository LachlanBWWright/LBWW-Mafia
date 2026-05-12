import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../combatLevel.js";
import { RoleGroup } from "../roleGroup.js";
import { GamePhase } from "../../rooms/gamePhase.js";
import type { RoleDefinition } from "../composition/roleDefinition.js";
import { RoleTrait } from "../composition/roleTraits.js";
import { chooseDayOther, chooseNightOther } from "../composition/handlers/targeting.js";
import {
  addAttacker,
  applyDamageMinimum,
  applyDefenceMinimum,
  chooseNightTarget,
  registerDayVisit,
  registerNightVisit,
  roleblockTarget,
  roleblockVisit,
} from "../composition/handlers/effects.js";
import {
  actorNotice,
  dispatchNotice,
} from "../composition/handlers/notices.js";
import {
  accepted,
  handled,
  notHandled,
  rejected,
} from "../composition/handlers/results.js";

const townTraits = [RoleTrait.TownAligned];
const NIMBY_ALERT_SLOTS = "nimby-alert-slots";
const FORTIFIER_CAN_FORTIFY = "fortifier-can-fortify";
const FORTIFIER_TARGET = "fortifier-target";
const VETTER_RESEARCH_SLOTS = "vetter-research-slots";

export const doctorDefinition: RoleDefinition = {
  kind: "built-in",
  id: "doctor",
  metadata: {
    name: "Doctor",
    group: RoleGroup.Town,
    category: "town-support",
    summary: "Heals another player at night.",
    description:
      "Choose one living non-self player at night and raise their defence.",
    isUnique: false,
  },
  balance: { power: 5 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    {
      onNightCommand: ({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.DoctorCannotHealSelf,
          MessageKey.DoctorChoseToHeal,
        ),
    },
    {
      onNightVisit: ({ role }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        applyDefenceMinimum(target, CombatLevel.Low);
      },
    },
  ],
};

export const investigatorDefinition: RoleDefinition = {
  kind: "built-in",
  id: "investigator",
  metadata: {
    name: "Investigator",
    group: RoleGroup.Town,
    category: "town-investigative",
    summary: "Inspects another player.",
    description: "Gets 3 possible roles with imperfect accuracy.",
    isUnique: false,
  },
  balance: { power: 4 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    {
      onNightCommand: ({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.CannotInspectSelf,
          MessageKey.ChoseToInspect,
        ),
    },
    {
      onNightVisit: ({ role }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        const guesses: string[] = [];
        for (let i = 0; i < 3; i++) {
          if (role.room.random() < 0.3) {
            guesses.push(target.name);
          } else {
            const randomPlayer =
              role.room.playerList[role.room.randomIndex(role.room.playerList.length)];
            guesses.push(randomPlayer?.role.name ?? target.name);
          }
        }
        dispatchNotice(
          role,
          actorNotice({
            key: MessageKey.InvestigatorResult,
            params: {
              targetName: target.player.username,
              role1: guesses[0] ?? "",
              role2: guesses[1] ?? "",
              role3: guesses[2] ?? "",
            },
          }),
        );
      },
    },
  ],
};

export const judgeDefinition: RoleDefinition = {
  kind: "built-in",
  id: "judge",
  metadata: {
    name: "Judge",
    group: RoleGroup.Town,
    category: "town-investigative",
    summary: "Checks alignment.",
    description: "Reports role group, sometimes false.",
    isUnique: false,
  },
  balance: { power: 6 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    {
      onNightCommand: ({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.JudgeCannotInspectSelf,
          MessageKey.ChoseToInspect,
        ),
    },
    {
      onNightVisit: ({ role }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        let factionName = target.group;
        if (role.room.random() < 0.3) {
          const living = role.room.playerList.filter((player) => player.isAlive);
          factionName =
            living[role.room.randomIndex(living.length)]?.role.group ??
            factionName;
        }
        dispatchNotice(
          role,
          actorNotice({
            key: MessageKey.JudgeAlignmentResult,
            params: { targetName: target.player.username, factionName },
          }),
        );
      },
    },
  ],
};

export const watchmanDefinition: RoleDefinition = {
  kind: "built-in",
  id: "watchman",
  metadata: {
    name: "Watchman",
    group: RoleGroup.Town,
    category: "town-investigative",
    summary: "Observes visitors.",
    description: "Sees who visited target at night.",
    isUnique: false,
  },
  balance: { power: 4 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    {
      onNightCommand: ({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.WatchmanCannotWatchSelf,
          MessageKey.WatchmanChoseToWatch,
        ),
    },
    { onNightVisit: ({ role }) => void registerNightVisit(role) },
    {
      onVisitOutcomes: ({ role }) => {
        const target = role.visiting;
        if (target === null) return;
        const visitorCount = target.visitors.length;
        if (visitorCount === 1) {
          dispatchNotice(role, actorNotice({ key: MessageKey.WatchmanNobodyVisited }));
          return;
        }
        if (visitorCount === 2) {
          const realVisitor =
            target.visitors[0] === role ? target.visitors[1] : target.visitors[0];
          dispatchNotice(
            role,
            actorNotice({
              key: MessageKey.WatchmanTargetVisitedBy,
              params: { targetName: realVisitor?.player.username ?? "" },
            }),
          );
          return;
        }
        const visitorList = target.visitors
          .filter((visitor) => visitor.player.isAlive && visitor !== role)
          .map((visitor) => visitor.player.username);
        const lastEntry = visitorList[visitorList.length - 1] ?? "";
        const list =
          visitorList.length > 1
            ? `${visitorList.slice(0, -1).join(", ")}, and ${lastEntry}`
            : lastEntry;
        dispatchNotice(
          role,
          actorNotice({ key: MessageKey.WatchmanVisitorList, params: { list } }),
        );
      },
    },
  ],
};

export const trackerDefinition: RoleDefinition = {
  kind: "built-in",
  id: "tracker",
  metadata: {
    name: "Tracker",
    group: RoleGroup.Town,
    category: "town-investigative",
    summary: "Tracks movement.",
    description: "Sees who target visited.",
    isUnique: false,
  },
  balance: { power: 5 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    {
      onNightCommand: ({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.TrackerCannotTrackSelf,
          MessageKey.TrackerChoseToTrack,
        ),
    },
    { onNightVisit: ({ role }) => void registerNightVisit(role) },
    {
      onVisitOutcomes: ({ role }) => {
        if (role.visiting?.visiting) {
          dispatchNotice(
            role,
            actorNotice({
              key: MessageKey.TrackerTargetVisited,
              params: { targetName: role.visiting.visiting.player.username },
            }),
          );
        } else {
          dispatchNotice(
            role,
            actorNotice({ key: MessageKey.TrackerTargetDidNotVisit }),
          );
        }
      },
    },
  ],
};

export const tapperDefinition: RoleDefinition = {
  kind: "built-in",
  id: "tapper",
  metadata: {
    name: "Tapper",
    group: RoleGroup.Town,
    category: "town-support",
    summary: "Wiretaps day or night.",
    description: "Can tap whispers and night chat.",
    isUnique: false,
  },
  balance: { power: 3 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: true,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    {
      onDayCommand: ({ role, recipient }) =>
        chooseDayOther(
          role,
          recipient,
          MessageKey.CannotTapSelf,
          MessageKey.ChoseToTap,
        ),
    },
    {
      onNightCommand: ({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.CannotTapSelf,
          MessageKey.ChoseToTap,
        ),
    },
    {
      onDayVisit: ({ role }) => {
        const target = registerDayVisit(role);
        if (!target) return;
        dispatchNotice(target, actorNotice({ key: MessageKey.YouHaveBeenWiretapped }));
        target.nightTappedBy = role;
      },
      onNightVisit: ({ role }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        target.dayTappedBy = role;
      },
    },
  ],
};

export const roleblockerDefinition: RoleDefinition = {
  kind: "built-in",
  id: "roleblocker",
  metadata: {
    name: "Roleblocker",
    group: RoleGroup.Town,
    category: "town-support",
    summary: "Blocks night action.",
    description: "Roleblocks target with conversion chance against non-town.",
    isUnique: false,
  },
  balance: { power: 5 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: [...townTraits, RoleTrait.Roleblocker],
  handlers: [
    {
      onNightCommand: ({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.CannotBlockSelf,
          MessageKey.ChoseToBlock,
        ),
    },
    roleblockVisit(false),
  ],
};

export const bodyguardDefinition: RoleDefinition = {
  kind: "built-in",
  id: "bodyguard",
  metadata: {
    name: "Bodyguard",
    group: RoleGroup.Town,
    category: "town-protective",
    summary: "Protects and retaliates.",
    description: "Protects target and hurts attackers.",
    isUnique: false,
  },
  balance: { power: 6 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    {
      onNightCommand: ({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.CannotProtectSelf,
          MessageKey.ChoseToProtect,
        ),
    },
    {
      onNightVisit: ({ role }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        applyDefenceMinimum(target, CombatLevel.Low);
      },
      onVisitOutcomes: ({ role }) => {
        if (role.visiting === null) return;
        for (const visitor of role.visiting.visitors) {
          if (visitor === role || visitor === role.visiting) continue;
          applyDamageMinimum(visitor, CombatLevel.Low);
          visitor.attackers.push(role);
        }
      },
    },
  ],
};

export const nimbyDefinition: RoleDefinition = {
  kind: "built-in",
  id: "nimby",
  metadata: {
    name: "Nimby",
    group: RoleGroup.Town,
    category: "town-protective",
    summary: "Self alert mode.",
    description: "Alerts consume charges and retaliate visitors.",
    isUnique: false,
  },
  balance: { power: 5 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: true,
    nightVisitOthers: false,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    {
      onAttach: ({ role }) => role.setPersistentCharge(NIMBY_ALERT_SLOTS, 3),
      onNightCommand: ({ role }) => {
        const alerts = role.getPersistentCharge(NIMBY_ALERT_SLOTS, 3);
        if (alerts === 0) {
          dispatchNotice(role, actorNotice({ key: MessageKey.NimbyNoAlerts }));
          return rejected;
        }
        if (role.visiting === role) {
          role.visiting = null;
          dispatchNotice(
            role,
            actorNotice({ key: MessageKey.NimbyDecidedNotAlert }),
          );
        } else {
          chooseNightTarget(role, role);
          dispatchNotice(role, actorNotice({ key: MessageKey.NimbyDecidedAlert }));
        }
        return accepted;
      },
      onNightVisit: ({ role }) => {
        if (role.visiting !== role) return;
        if (role.defence === CombatLevel.None) {
          role.defence = CombatLevel.Low;
          const alerts = role.getPersistentCharge(NIMBY_ALERT_SLOTS, 3);
          role.setPersistentCharge(
            NIMBY_ALERT_SLOTS,
            Math.max(0, alerts - 1),
          );
        }
        role.receiveVisit(role);
      },
      onVisitOutcomes: ({ role }) => {
        if (role.visiting !== role) return;
        for (const visitor of role.visitors) {
          if (visitor === role) continue;
          applyDamageMinimum(visitor, CombatLevel.Low);
        }
      },
    },
  ],
};

export const sacrificerDefinition: RoleDefinition = {
  kind: "built-in",
  id: "sacrificer",
  metadata: {
    name: "Sacrificer",
    group: RoleGroup.Town,
    category: "town-protective",
    summary: "Sacrifices self to save target.",
    description: "If target is attacked, dies and reveals attackers.",
    isUnique: false,
  },
  balance: { power: 8 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    {
      onNightCommand: ({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.CannotProtectSelf,
          MessageKey.ChoseToProtect,
        ),
    },
    { onNightVisit: ({ role }) => void registerNightVisit(role) },
    {
      onVisitOutcomes: ({ role }) => {
        const target = role.visiting;
        if (target === null || target.attackers.length === 0) return;
        target.defence = CombatLevel.High;
        dispatchNotice(role, actorNotice({ key: MessageKey.SacrificerDied }));
        dispatchNotice(target, actorNotice({ key: MessageKey.TargetSavedBySacricer }));
        role.damage = CombatLevel.Critical;
        for (const attacker of target.attackers) {
          dispatchNotice(
            target,
            actorNotice({
              key: MessageKey.AttackedByWithRole,
              params: {
                playerName: attacker.player.username,
                roleName: attacker.name,
              },
            }),
          );
        }
      },
    },
  ],
};

export const fortifierDefinition: RoleDefinition = {
  kind: "built-in",
  id: "fortifier",
  metadata: {
    name: "Fortifier",
    group: RoleGroup.Town,
    category: "town-protective",
    summary: "Applies persistent fortification.",
    description: "Fortifies a house, then may strip with fatal risk.",
    isUnique: false,
  },
  balance: { power: 8 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    {
      onAttach: ({ role }) => {
        role.setPersistentFlag(FORTIFIER_CAN_FORTIFY, true);
        role.setPersistentTarget(FORTIFIER_TARGET, null);
      },
      onNightCommand: ({ role, recipient }) => {
        const canFortify = role.getPersistentFlag(FORTIFIER_CAN_FORTIFY);
        const fortifiedTarget = role.getPersistentTarget(FORTIFIER_TARGET);

        if (recipient === role.player) {
          dispatchNotice(
            role,
            actorNotice({ key: MessageKey.FortifierCannotFortifySelf }),
          );
          return rejected;
        }

        if (canFortify && recipient.isAlive) {
          dispatchNotice(
            role,
            actorNotice({
              key: MessageKey.FortifierChoseToFortify,
              params: { targetName: recipient.username },
            }),
          );
          role.visiting = recipient.role;
          return accepted;
        }

        if (fortifiedTarget && fortifiedTarget.player.isAlive && !canFortify) {
          dispatchNotice(
            role,
            actorNotice({
              key: MessageKey.FortifierChoseToRemove,
              params: { targetName: fortifiedTarget.player.username },
            }),
          );
          role.visiting = fortifiedTarget;
          return accepted;
        }

        dispatchNotice(
          role,
          actorNotice({
            key: fortifiedTarget
              ? MessageKey.FortifierCannotRemoveDead
              : MessageKey.InvalidChoice,
          }),
        );
        return rejected;
      },
      onNightVisit: ({ role }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        const canFortify = role.getPersistentFlag(FORTIFIER_CAN_FORTIFY);
        const fortifiedTarget = role.getPersistentTarget(FORTIFIER_TARGET);

        if (canFortify) {
          role.setPersistentFlag(FORTIFIER_CAN_FORTIFY, false);
          role.setPersistentTarget(FORTIFIER_TARGET, target);
          target.baseDefence += CombatLevel.Medium;
          dispatchNotice(
            target,
            actorNotice({ key: MessageKey.FortifierHouseFortified }),
          );
          return;
        }

        if (!fortifiedTarget) return;
        fortifiedTarget.baseDefence -= CombatLevel.Medium;
        role.setPersistentTarget(FORTIFIER_TARGET, null);
        if (role.room.random() > 0.5) {
          dispatchNotice(
            role,
            actorNotice({ key: MessageKey.FortifierDiedStripping }),
          );
          dispatchNotice(
            fortifiedTarget,
            actorNotice({
              key: MessageKey.FortifierOwnerDiedStripping,
              params: { playerName: fortifiedTarget.player.username },
            }),
          );
          role.damage = CombatLevel.Fatal;
        } else {
          dispatchNotice(
            role,
            actorNotice({ key: MessageKey.FortifierStrippedKilledOwner }),
          );
          dispatchNotice(
            fortifiedTarget,
            actorNotice({ key: MessageKey.FortifierTargetDied }),
          );
          fortifiedTarget.damage = CombatLevel.Fatal;
        }
      },
      onVisitOutcomes: ({ role }) => {
        const fortifiedTarget = role.getPersistentTarget(FORTIFIER_TARGET);
        if (!fortifiedTarget) return;
        for (const attacker of fortifiedTarget.attackers) {
          if (attacker !== role && attacker !== fortifiedTarget) {
            applyDamageMinimum(attacker, CombatLevel.Low);
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
  metadata: {
    name: "Jailor",
    group: RoleGroup.Town,
    category: "town-killing",
    summary: "Jails by day, can execute by night.",
    description: "Private night chat with jailed target.",
    isUnique: true,
  },
  balance: { power: 12 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: true,
    dayVisitFaction: false,
    nightVisitSelf: true,
    nightVisitOthers: false,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: [...townTraits, RoleTrait.Unique],
  handlers: [
    {
      onHandleMessage: ({ role, message }) => {
        if (role.room.time === GamePhase.Day || role.dayVisiting === null) {
          return notHandled;
        }
        dispatchNotice(
          role,
          actorNotice(`Jailor: ${message}`, ServerEvent.ReceiveChatMessage),
        );
        dispatchNotice(role, {
          target: role.dayVisiting.player,
          event: ServerEvent.ReceiveChatMessage,
          message: `Jailor: ${message}`,
        });
        return handled;
      },
      onDayCommand: ({ role, recipient }) =>
        chooseDayOther(
          role,
          recipient,
          MessageKey.JailorCannotJailSelf,
          MessageKey.JailorChoseToJail,
        ),
      onNightCommand: ({ role }) => {
        if (role.dayVisiting === null) {
          dispatchNotice(role, actorNotice({ key: MessageKey.JailorNoJailed }));
          return rejected;
        }
        if (role.visiting === null) {
          role.visiting = role.dayVisiting;
          dispatchNotice(
            role,
            actorNotice({ key: MessageKey.JailorDecidedToExecute }),
          );
          dispatchNotice(role, {
            target: role.dayVisiting.player,
            event: ServerEvent.ReceiveMessage,
            message: { key: MessageKey.JailedWillBeExecuted },
          });
        } else {
          role.visiting = null;
          dispatchNotice(
            role,
            actorNotice({ key: MessageKey.JailorDecidedNotToExecute }),
          );
          dispatchNotice(role, {
            target: role.dayVisiting.player,
            event: ServerEvent.ReceiveMessage,
            message: { key: MessageKey.JailedWillNotBeExecuted },
          });
        }
        return accepted;
      },
      onDayVisit: ({ role }) => {
        const target = role.dayVisiting;
        if (target === null) return;
        dispatchNotice(target, actorNotice({ key: MessageKey.YouHaveBeenJailed }));
        dispatchNotice(role, actorNotice({ key: MessageKey.JailorJailedTarget }));
        target.jailed = role;
        roleblockTarget(target, role);
      },
      onNightVisit: ({ role }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        applyDamageMinimum(target, CombatLevel.High);
        addAttacker(target, role);
      },
      onVisitOutcomes: ({ role }) => {
        const target = role.dayVisiting;
        if (target === null) return;
        target.jailed = null;
        if (target.baseDefence === CombatLevel.None) {
          target.defence = CombatLevel.Low;
        }
      },
    },
  ],
};

export const lawmanDefinition: RoleDefinition = {
  kind: "built-in",
  id: "lawman",
  metadata: {
    name: "Lawman",
    group: RoleGroup.Town,
    category: "town-killing",
    summary: "Shoots at night, can become insane.",
    description: "If shoots town, becomes insane and forced random visits.",
    isUnique: true,
  },
  balance: { power: 8 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: [...townTraits, RoleTrait.LawmanFactionMember, RoleTrait.Unique],
  handlers: [
    { onAttach: ({ role }) => (role.isInsane = false) },
    {
      onNightCommand: ({ role, recipient }) => {
        if (role.isInsane) {
          dispatchNotice(role, actorNotice({ key: MessageKey.LawmanInsane }));
          return rejected;
        }
        return chooseNightOther(
          role,
          recipient,
          MessageKey.LawmanCannotShootSelf,
          MessageKey.ChoseToAttack,
        );
      },
    },
    {
      onNightVisit: ({ role }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        if (role.isInsane) {
          dispatchNotice(
            role,
            actorNotice({ key: MessageKey.LawmanInsaneShooting }),
          );
        }
        applyDamageMinimum(target, CombatLevel.Low);
        addAttacker(target, role);
        if (target.group === RoleGroup.Town) {
          role.isInsane = true;
          dispatchNotice(
            role,
            actorNotice({ key: MessageKey.LawmanShotTownMember }),
          );
        }
      },
    },
  ],
};

export const vetterDefinition: RoleDefinition = {
  kind: "built-in",
  id: "vetter",
  metadata: {
    name: "Vetter",
    group: RoleGroup.Town,
    category: "town-investigative",
    summary: "Researches two random players.",
    description: "Limited self-use research sessions.",
    isUnique: false,
  },
  balance: { power: 4 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: true,
    nightVisitOthers: false,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: [
    {
      onAttach: ({ role }) => role.setPersistentCharge(VETTER_RESEARCH_SLOTS, 3),
      onNightCommand: ({ role }) => {
        const researchSlots = role.getPersistentCharge(VETTER_RESEARCH_SLOTS, 3);
        if (researchSlots === 0) {
          dispatchNotice(role, actorNotice({ key: MessageKey.VetterNoSessions }));
          return rejected;
        }
        if (role.visiting === role) {
          role.visiting = null;
          dispatchNotice(
            role,
            actorNotice({ key: MessageKey.VetterDecidedNotToResearch }),
          );
        } else {
          chooseNightTarget(role, role);
          dispatchNotice(
            role,
            actorNotice({ key: MessageKey.VetterDecidedToResearch }),
          );
        }
        return accepted;
      },
      onNightVisit: ({ role }) => {
        if (role.visiting !== role) return;
        registerNightVisit(role);
        const nextCount = Math.max(
          0,
          role.getPersistentCharge(VETTER_RESEARCH_SLOTS, 3) - 1,
        );
        role.setPersistentCharge(VETTER_RESEARCH_SLOTS, nextCount);

        const p1 = role.room.randomIndex(role.room.playerList.length);
        let p2 = p1;
        while (p2 === p1 && role.room.playerList.length > 1) {
          p2 = role.room.randomIndex(role.room.playerList.length);
        }
        const reported = role.room.random() > 0.5 ? p1 : p2;
        dispatchNotice(
          role,
          actorNotice({
            key: MessageKey.VetterResearchResult,
            params: {
              name1: role.room.playerList[p1]?.username ?? "",
              name2: role.room.playerList[p2]?.username ?? "",
              roleName: role.room.playerList[reported]?.role.name ?? "",
            },
          }),
        );
        dispatchNotice(
          role,
          actorNotice({
            key: MessageKey.VetterSessionsLeft,
            params: { count: nextCount },
          }),
        );
      },
    },
  ],
};
