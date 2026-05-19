import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import { registerNightVisit } from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { mafiaTraits, mafiaVoteHandler } from "./shared.js";

export const mafiaInvestigatorDefinition = {
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
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: true,
  },
  traits: mafiaTraits,
  handlers: createRoleHandlers(
    mafiaVoteHandler(),
    {
      onNightCommand: [({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.CannotInspectSelf,
          MessageKey.ChoseToInspect,
        )],
    },
    {
      onNightVisit: [({ role }) => {
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
      }],
    },
  ),
} satisfies RoleDefinition;
