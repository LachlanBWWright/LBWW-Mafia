import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { RoleTrait } from "../../composition/roleTraits.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import { roleblockVisit } from "../../composition/handlers/effects.js";
import { townTraits } from "./shared.js";

export const roleblockerDefinition = {
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
    roleblockVisit(false),
  ),
} satisfies RoleDefinition;
