import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import { registerNightVisit } from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { townTraits } from "./shared.js";

export const trackerDefinition = {
  kind: "built-in",
  id: "tracker",
  metadata: {
    name: "Tracker",
    group: RoleGroup.Town,
    category: "town-investigative",
    summary: "Tracks movement.",
    description: "Sees who target visited.",
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
  traits: townTraits,
  handlers: createRoleHandlers(
    {
      onNightCommand: [({ role, recipient }) =>
        chooseNightOther(
          role,
          recipient,
          MessageKey.TrackerCannotTrackSelf,
          MessageKey.TrackerChoseToTrack,
        )],
    },
    { onNightVisit: [({ role }) => void registerNightVisit(role)] },
    {
      onVisitOutcomes: [({ role }) => {
        if (role.visiting?.visiting) {
          dispatchNotice(
            role,
            actorNotice({
              key: MessageKey.TrackerTargetVisited,
              params: { targetName: role.visiting.visiting.player.username },
            }),
          );
        } else {
          dispatchNotice(role, actorNotice({ key: MessageKey.TrackerTargetDidNotVisit }));
        }
      }],
    },
  ),
} satisfies RoleDefinition;
