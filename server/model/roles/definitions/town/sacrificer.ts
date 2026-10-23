import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import { registerNightVisit } from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { townTraits } from "./shared.js";

export const sacrificerDefinition = {
  kind: "built-in",
  id: "sacrificer",
  metadata: {
    name: "Sacrificer",
    group: RoleGroup.Town,
    category: "town-protective",
    summary: "Sacrifices self to save target.",
    description: "If target is attacked, dies and reveals attackers.",
    isUnique: false,
  },
  balance: { power: 8 },
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
          MessageKey.CannotProtectSelf,
          MessageKey.ChoseToProtect,
        )],
    },
    { onNightVisit: [({ role }) => void registerNightVisit(role)] },
    {
      onVisitOutcomes: [({ role }) => {
        const target = role.visiting;
        if (target === null || target.attackers.length === 0) return;
        target.defence = CombatLevel.High;
        dispatchNotice(role, actorNotice({ key: MessageKey.SacrificerDied }));
        dispatchNotice(target, actorNotice({ key: MessageKey.TargetSavedBySacricer }));
        role.damage = CombatLevel.Critical;
        for (const attacker of target.attackers) {
          dispatchNotice(
            target,
            actorNotice({
              key: MessageKey.AttackedByWithRole,
              params: {
                playerName: attacker.player.username,
                roleName: attacker.name,
              },
            }),
          );
        }
      }],
    },
  ),
} satisfies RoleDefinition;
