import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import {
  applyDamageMinimum,
  chooseNightTarget,
} from "../../composition/handlers/effects.js";
import { accepted, rejected } from "../../composition/handlers/results.js";
import { NIMBY_ALERT_SLOTS, townTraits } from "./shared.js";

export const nimbyDefinition = {
  kind: "built-in",
  id: "nimby",
  metadata: {
    name: "Nimby",
    group: RoleGroup.Town,
    category: "town-protective",
    summary: "Self alert mode.",
    description: "Alerts consume charges and retaliate visitors.",
    isUnique: false,
  },
  balance: { power: 5 },
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
  handlers: createRoleHandlers({
    onAttach: [({ role }) => role.setPersistentCharge(NIMBY_ALERT_SLOTS, 3)],
    onNightCommand: [({ role }) => {
      const alerts = role.getPersistentCharge(NIMBY_ALERT_SLOTS, 3);
      if (alerts === 0) {
        dispatchNotice(role, actorNotice({ key: MessageKey.NimbyNoAlerts }));
        return rejected;
      }
      if (role.visiting === role) {
        role.visiting = null;
        dispatchNotice(role, actorNotice({ key: MessageKey.NimbyDecidedNotAlert }));
      } else {
        chooseNightTarget(role, role);
        dispatchNotice(role, actorNotice({ key: MessageKey.NimbyDecidedAlert }));
      }
      return accepted;
    }],
    onNightVisit: [({ role }) => {
      if (role.visiting !== role) return;
      if (role.defence === CombatLevel.None) {
        role.defence = CombatLevel.Low;
        const alerts = role.getPersistentCharge(NIMBY_ALERT_SLOTS, 3);
        role.setPersistentCharge(NIMBY_ALERT_SLOTS, Math.max(0, alerts - 1));
      }
      role.receiveVisit(role);
    }],
    onVisitOutcomes: [({ role }) => {
      if (role.visiting !== role) return;
      for (const visitor of role.visitors) {
        if (visitor === role) continue;
        applyDamageMinimum(visitor, CombatLevel.Low);
      }
    }],
  }),
} satisfies RoleDefinition;
