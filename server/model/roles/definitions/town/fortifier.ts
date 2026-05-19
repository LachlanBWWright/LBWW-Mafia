import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import {
  registerNightVisit,
  applyDamageMinimum,
} from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { accepted, rejected } from "../../composition/handlers/results.js";
import {
  FORTIFIER_CAN_FORTIFY,
  FORTIFIER_TARGET,
  townTraits,
} from "./shared.js";

export const fortifierDefinition = {
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
  handlers: createRoleHandlers(
    {
      onAttach: [({ role }) => {
        role.setPersistentFlag(FORTIFIER_CAN_FORTIFY, true);
        role.setPersistentTarget(FORTIFIER_TARGET, null);
      }],
      onNightCommand: [({ role, recipient }) => {
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
      }],
      onNightVisit: [({ role }) => {
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
          dispatchNotice(role, actorNotice({ key: MessageKey.FortifierDiedStripping }));
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
      }],
      onVisitOutcomes: [({ role }) => {
        const fortifiedTarget = role.getPersistentTarget(FORTIFIER_TARGET);
        if (!fortifiedTarget) return;
        for (const attacker of fortifiedTarget.attackers) {
          if (attacker !== role && attacker !== fortifiedTarget) {
            applyDamageMinimum(attacker, CombatLevel.Low);
            attacker.attackers.push(role);
          }
        }
      }],
    },
  ),
} satisfies RoleDefinition;
