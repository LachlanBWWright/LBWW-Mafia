import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { RoleTrait } from "../../composition/roleTraits.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import { roleblockVisit } from "../../composition/handlers/effects.js";
import { mafiaTraits, mafiaVoteHandler } from "./shared.js";

export const mafiaRoleblockerDefinition = {
  kind: "built-in",
  id: "mafia-roleblocker",
  metadata: {
    name: "Mafia Roleblocker",
    group: RoleGroup.Mafia,
    category: "mafia-support",
    summary: "Roleblocks while in mafia faction.",
    description: "Can roleblock and still participate in faction attack voting.",
    isUnique: false,
  },
  balance: { power: -20 },
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
  traits: [...mafiaTraits, RoleTrait.Roleblocker],
  handlers: createRoleHandlers(
    mafiaVoteHandler(),
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
