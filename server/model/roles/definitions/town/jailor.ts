import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import { GamePhase } from "../../../rooms/gamePhase.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { RoleTrait } from "../../composition/roleTraits.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { chooseDayOther } from "../../composition/handlers/targeting.js";
import {
  addAttacker,
  applyDamageMinimum,
  registerNightVisit,
  roleblockTarget,
} from "../../composition/handlers/effects.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { accepted, handled, notHandled, rejected } from "../../composition/handlers/results.js";
import { townTraits } from "./shared.js";

export const jailorDefinition = {
  kind: "built-in",
  id: "jailor",
  metadata: {
    name: "Jailor",
    group: RoleGroup.Town,
    category: "town-killing",
    summary: "Jails by day, can execute by night.",
    description: "Private night chat with jailed target.",
    isUnique: true,
  },
  balance: { power: 12 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: true,
    dayVisitFaction: false,
    nightVisitSelf: true,
    nightVisitOthers: false,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: [...townTraits, RoleTrait.Unique],
  handlers: createRoleHandlers({
    onHandleMessage: [({ role, message }) => {
      if (role.room.time === GamePhase.Day || role.dayVisiting === null) {
        return notHandled;
      }
      dispatchNotice(
        role,
        actorNotice(`Jailor: ${message}`, ServerEvent.ReceiveChatMessage),
      );
      dispatchNotice(role, {
        target: role.dayVisiting.player,
        event: ServerEvent.ReceiveChatMessage,
        message: `Jailor: ${message}`,
      });
      return handled;
    }],
    onDayCommand: [({ role, recipient }) =>
      chooseDayOther(
        role,
        recipient,
        MessageKey.JailorCannotJailSelf,
        MessageKey.JailorChoseToJail,
      )],
    onNightCommand: [({ role }) => {
      if (role.dayVisiting === null) {
        dispatchNotice(role, actorNotice({ key: MessageKey.JailorNoJailed }));
        return rejected;
      }
      if (role.visiting === null) {
        role.visiting = role.dayVisiting;
        dispatchNotice(role, actorNotice({ key: MessageKey.JailorDecidedToExecute }));
        dispatchNotice(role, {
          target: role.dayVisiting.player,
          event: ServerEvent.ReceiveMessage,
          message: { key: MessageKey.JailedWillBeExecuted },
        });
      } else {
        role.visiting = null;
        dispatchNotice(
          role,
          actorNotice({ key: MessageKey.JailorDecidedNotToExecute }),
        );
        dispatchNotice(role, {
          target: role.dayVisiting.player,
          event: ServerEvent.ReceiveMessage,
          message: { key: MessageKey.JailedWillNotBeExecuted },
        });
      }
      return accepted;
    }],
    onDayVisit: [({ role }) => {
      const target = role.dayVisiting;
      if (target === null) return;
      dispatchNotice(target, actorNotice({ key: MessageKey.YouHaveBeenJailed }));
      dispatchNotice(role, actorNotice({ key: MessageKey.JailorJailedTarget }));
      target.jailed = role;
      roleblockTarget(target, role);
    }],
    onNightVisit: [({ role }) => {
      const target = registerNightVisit(role);
      if (!target) return;
      applyDamageMinimum(target, CombatLevel.High);
      addAttacker(target, role);
    }],
    onVisitOutcomes: [({ role }) => {
      const target = role.dayVisiting;
      if (target === null) return;
      target.jailed = null;
      if (target.baseDefence === CombatLevel.None) {
        target.defence = CombatLevel.Low;
      }
    }],
  }),
} satisfies RoleDefinition;
