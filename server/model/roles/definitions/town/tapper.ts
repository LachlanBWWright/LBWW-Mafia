import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseDayOther, chooseNightOther } from "../../composition/handlers/targeting.js";
import { registerDayVisit, registerNightVisit } from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { townTraits } from "./shared.js";

export const tapperDefinition = {
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
  handlers: createRoleHandlers(
    {
      onDayCommand: [({ role, recipient }) =>
        chooseDayOther(
          role,
          recipient,
          MessageKey.CannotTapSelf,
          MessageKey.ChoseToTap,
        )],
    },
    {
      onNightCommand: [({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.CannotTapSelf,
          MessageKey.ChoseToTap,
        )],
    },
    {
      onDayVisit: [({ role }) => {
        const target = registerDayVisit(role);
        if (!target) return;
        dispatchNotice(target, actorNotice({ key: MessageKey.YouHaveBeenWiretapped }));
        target.nightTappedBy = role;
      }],
      onNightVisit: [({ role }) => {
        const target = registerNightVisit(role);
        if (!target) return;
        target.dayTappedBy = role;
      }],
    },
  ),
} satisfies RoleDefinition;
