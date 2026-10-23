import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { RoleTrait } from "../../composition/roleTraits.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import { roleblockVisit } from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";

export const peacemakerDefinition = {
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
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: [
    RoleTrait.NeutralAligned,
    RoleTrait.Unique,
    RoleTrait.Peacemaker,
    RoleTrait.Roleblocker,
  ],
  handlers: createRoleHandlers(
    {
      onNightCommand: [({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.CannotBlockSelf,
          MessageKey.ChoseToBlock,
        )],
    },
    roleblockVisit(true),
    {
      onNoDeathDraw: [({ role }) => {
        role.victoryCondition = true;
        dispatchNotice(role, actorNotice({ key: MessageKey.PeacemakerWon }));
      }],
    },
  ),
} satisfies RoleDefinition;
