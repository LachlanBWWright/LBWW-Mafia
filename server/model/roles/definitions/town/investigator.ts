import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import { registerNightVisit } from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { townTraits } from "./shared.js";

export const investigatorDefinition = {
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
  handlers: createRoleHandlers(
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
      }],
    },
  ),
} satisfies RoleDefinition;
