import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import { registerNightVisit } from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { townTraits } from "./shared.js";

export const judgeDefinition = {
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
  handlers: createRoleHandlers({
    onNightCommand: [({ role, recipient }) =>
      chooseNightOther(
        role,
        recipient,
        MessageKey.JudgeCannotInspectSelf,
        MessageKey.ChoseToInspect,
      )],
    onNightVisit: [({ role }) => {
      const target = registerNightVisit(role);
      if (!target) return;
      let factionName = target.group;
      if (role.room.random() < 0.3) {
        const living = role.room.playerList.filter((player) => player.isAlive);
        factionName =
          living[role.room.randomIndex(living.length)]?.role.group ?? factionName;
      }
      dispatchNotice(
        role,
        actorNotice({
          key: MessageKey.JudgeAlignmentResult,
          params: { targetName: target.player.username, factionName },
        }),
      );
    }],
  }),
} satisfies RoleDefinition;
