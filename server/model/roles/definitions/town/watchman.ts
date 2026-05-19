import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import { registerNightVisit } from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { townTraits } from "./shared.js";

export const watchmanDefinition = {
  kind: "built-in",
  id: "watchman",
  metadata: {
    name: "Watchman",
    group: RoleGroup.Town,
    category: "town-investigative",
    summary: "Observes visitors.",
    description: "Sees who visited target at night.",
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
          MessageKey.WatchmanCannotWatchSelf,
          MessageKey.WatchmanChoseToWatch,
        )],
    },
    { onNightVisit: [({ role }) => void registerNightVisit(role)] },
    {
      onVisitOutcomes: [({ role }) => {
        const target = role.visiting;
        if (target === null) return;
        const visitorCount = target.visitors.length;
        if (visitorCount === 1) {
          dispatchNotice(role, actorNotice({ key: MessageKey.WatchmanNobodyVisited }));
          return;
        }
        if (visitorCount === 2) {
          const realVisitor =
            target.visitors[0] === role ? target.visitors[1] : target.visitors[0];
          dispatchNotice(
            role,
            actorNotice({
              key: MessageKey.WatchmanTargetVisitedBy,
              params: { targetName: realVisitor?.player.username ?? "" },
            }),
          );
          return;
        }
        const visitorList = target.visitors
          .filter((visitor) => visitor.player.isAlive && visitor !== role)
          .map((visitor) => visitor.player.username);
        const lastEntry = visitorList[visitorList.length - 1] ?? "";
        const list =
          visitorList.length > 1
            ? `${visitorList.slice(0, -1).join(", ")}, and ${lastEntry}`
            : lastEntry;
        dispatchNotice(
          role,
          actorNotice({ key: MessageKey.WatchmanVisitorList, params: { list } }),
        );
      }],
    },
  ),
} satisfies RoleDefinition;
