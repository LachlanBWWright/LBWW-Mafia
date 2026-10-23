import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { RoleTrait } from "../../composition/roleTraits.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import {
  applyDamageMinimum,
  registerNightVisit,
} from "../../composition/handlers/effects.js";
import { SNIPER_LAST_VISITED_SLOT } from "./shared.js";

export const sniperDefinition = {
  kind: "built-in",
  id: "sniper",
  metadata: {
    name: "Sniper",
    group: RoleGroup.Sniper,
    category: "neutral-killing",
    summary: "High burst attacker.",
    description: "Damage depends on target movement.",
    isUnique: true,
  },
  balance: { power: -10 },
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
          MessageKey.SniperCannotSnipeSelf,
          MessageKey.SniperChoseToSnipe,
        )],
    },
    { onNightVisit: [({ role }) => void registerNightVisit(role)] },
    {
      onVisitOutcomes: [({ role }) => {
        const target = role.visiting;
        if (target === null) return;
        const lastVisited = role.getPersistentTarget(SNIPER_LAST_VISITED_SLOT);
        if (target.visiting === target || target.visiting === null) {
          applyDamageMinimum(target, CombatLevel.High);
        } else if (lastVisited === target && target.damage === CombatLevel.None) {
          target.damage = CombatLevel.Low;
        }
        role.setPersistentTarget(SNIPER_LAST_VISITED_SLOT, target);
      }],
    },
  ),
} satisfies RoleDefinition;
