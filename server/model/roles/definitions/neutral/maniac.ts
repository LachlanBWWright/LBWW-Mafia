import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { RoleTrait } from "../../composition/roleTraits.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import { simpleAttack } from "../../composition/handlers/effects.js";

export const maniacDefinition = {
  kind: "built-in",
  id: "maniac",
  metadata: {
    name: "Maniac",
    group: RoleGroup.Maniac,
    category: "neutral-killing",
    summary: "Neutral attacker.",
    description: "Attacks one target each night.",
    isUnique: true,
  },
  balance: { power: -12 },
  combat: { baseDefence: CombatLevel.Low },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: true,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: [RoleTrait.NeutralAligned, RoleTrait.Unique],
  handlers: createRoleHandlers(
    {
      onNightCommand: [({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.ManiacCannotAttackSelf,
          MessageKey.ChoseToAttack,
        )],
    },
    simpleAttack(CombatLevel.Low),
  ),
} satisfies RoleDefinition;
