import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { RoleTrait } from "../../composition/roleTraits.js";
import { chooseNightOther } from "../../composition/handlers/targeting.js";
import {
  addAttacker,
  applyDamageMinimum,
  registerNightVisit,
} from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { rejected } from "../../composition/handlers/results.js";
import { townTraits } from "./shared.js";

export const lawmanDefinition = {
  kind: "built-in",
  id: "lawman",
  metadata: {
    name: "Lawman",
    group: RoleGroup.Town,
    category: "town-killing",
    summary: "Shoots at night, can become insane.",
    description: "If shoots town, becomes insane and forced random visits.",
    isUnique: true,
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
  traits: [...townTraits, RoleTrait.LawmanFactionMember, RoleTrait.Unique],
  handlers: createRoleHandlers({
    onAttach: [({ role }) => (role.isInsane = false)],
    onNightCommand: [({ role, recipient }) => {
      if (role.isInsane) {
        dispatchNotice(role, actorNotice({ key: MessageKey.LawmanInsane }));
        return rejected;
      }
      return chooseNightOther(
        role,
        recipient,
        MessageKey.LawmanCannotShootSelf,
        MessageKey.ChoseToAttack,
      );
    }],
    onNightVisit: [({ role }) => {
      const target = registerNightVisit(role);
      if (!target) return;
      if (role.isInsane) {
        dispatchNotice(role, actorNotice({ key: MessageKey.LawmanInsaneShooting }));
      }
      applyDamageMinimum(target, CombatLevel.Low);
      addAttacker(target, role);
      if (target.group === RoleGroup.Town) {
        role.isInsane = true;
        dispatchNotice(role, actorNotice({ key: MessageKey.LawmanShotTownMember }));
      }
    }],
  }),
} satisfies RoleDefinition;
