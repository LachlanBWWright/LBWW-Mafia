import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseNightTarget, registerNightVisit } from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { accepted, rejected } from "../../composition/handlers/results.js";
import { VETTER_RESEARCH_SLOTS, townTraits } from "./shared.js";

export const vetterDefinition = {
  kind: "built-in",
  id: "vetter",
  metadata: {
    name: "Vetter",
    group: RoleGroup.Town,
    category: "town-investigative",
    summary: "Researches two random players.",
    description: "Limited self-use research sessions.",
    isUnique: false,
  },
  balance: { power: 4 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: true,
    nightVisitOthers: false,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: townTraits,
  handlers: createRoleHandlers(
    {
      onAttach: [({ role }) => role.setPersistentCharge(VETTER_RESEARCH_SLOTS, 3)],
      onNightCommand: [({ role }) => {
        const researchSlots = role.getPersistentCharge(VETTER_RESEARCH_SLOTS, 3);
        if (researchSlots === 0) {
          dispatchNotice(role, actorNotice({ key: MessageKey.VetterNoSessions }));
          return rejected;
        }
        if (role.visiting === role) {
          role.visiting = null;
          dispatchNotice(role, actorNotice({ key: MessageKey.VetterDecidedNotToResearch }));
        } else {
          chooseNightTarget(role, role);
          dispatchNotice(role, actorNotice({ key: MessageKey.VetterDecidedToResearch }));
        }
        return accepted;
      }],
      onNightVisit: [({ role }) => {
        if (role.visiting !== role) return;
        registerNightVisit(role);
        const nextCount = Math.max(
          0,
          role.getPersistentCharge(VETTER_RESEARCH_SLOTS, 3) - 1,
        );
        role.setPersistentCharge(VETTER_RESEARCH_SLOTS, nextCount);

        const p1 = role.room.randomIndex(role.room.playerList.length);
        let p2 = p1;
        while (p2 === p1 && role.room.playerList.length > 1) {
          p2 = role.room.randomIndex(role.room.playerList.length);
        }
        const reported = role.room.random() > 0.5 ? p1 : p2;
        dispatchNotice(
          role,
          actorNotice({
            key: MessageKey.VetterResearchResult,
            params: {
              name1: role.room.playerList[p1]?.username ?? "",
              name2: role.room.playerList[p2]?.username ?? "",
              roleName: role.room.playerList[reported]?.role.name ?? "",
            },
          }),
        );
        dispatchNotice(
          role,
          actorNotice({
            key: MessageKey.VetterSessionsLeft,
            params: { count: nextCount },
          }),
        );
      }],
    },
  ),
} satisfies RoleDefinition;
