import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import {
  applyDamageMinimum,
  applyDefenceMinimum,
  registerNightVisit,
} from "../../composition/handlers/effects.js";
import { townTraits } from "./shared.js";

export const bodyguardDefinition = {
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
  handlers: createRoleHandlers(
    {
      onNightCommand: [({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.CannotProtectSelf,
          MessageKey.ChoseToProtect,
        )],
    },
    {
      onNightVisit: [({ role }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        applyDefenceMinimum(target, CombatLevel.Low);
      }],
      onVisitOutcomes: [({ role }) => {
        if (role.visiting === null) return;
        for (const visitor of role.visiting.visitors) {
          if (visitor === role || visitor === role.visiting) continue;
          applyDamageMinimum(visitor, CombatLevel.Low);
          visitor.attackers.push(role);
        }
      }],
    },
  ),
} satisfies RoleDefinition;
