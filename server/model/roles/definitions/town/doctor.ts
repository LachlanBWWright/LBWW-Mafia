import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import {
  applyDefenceMinimum,
  registerNightVisit,
} from "../../composition/handlers/effects.js";
import { townTraits } from "./shared.js";

export const doctorDefinition = {
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
  handlers: createRoleHandlers(
    {
      onNightCommand: [({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.DoctorCannotHealSelf,
          MessageKey.DoctorChoseToHeal,
        )],
    },
    {
      onNightVisit: [({ role }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        applyDefenceMinimum(target, CombatLevel.Low);
      }],
    },
  ),
} satisfies RoleDefinition;
