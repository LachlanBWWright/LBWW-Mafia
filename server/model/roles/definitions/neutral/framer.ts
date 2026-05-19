import { MessageKey } from "@mernmafia/shared/communication/messages";
import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { RoleTrait } from "../../composition/roleTraits.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { actorNotice, dispatchNotice } from "../../composition/handlers/notices.js";
import { FRAMER_TARGET_SLOT, findLivingTownTarget } from "./shared.js";

export const framerDefinition = {
  kind: "built-in",
  id: "framer",
  metadata: {
    name: "Framer",
    group: RoleGroup.Neutral,
    category: "neutral-chaos",
    summary: "Wins when marked town target is voted out.",
    description: "Gets and refreshes a random living town target.",
    isUnique: true,
  },
  balance: { power: -5 },
  combat: { baseDefence: CombatLevel.Low },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: false,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: [RoleTrait.NeutralAligned, RoleTrait.Unique, RoleTrait.Framer],
  handlers: createRoleHandlers({
    onInit: [({ role }) => {
      const target = findLivingTownTarget(role);
      if (!target) return;
      role.setPersistentTarget(FRAMER_TARGET_SLOT, target.role);
      dispatchNotice(
        role,
        actorNotice({
          key: MessageKey.FramerTarget,
          params: { targetName: target.username },
        }),
      );
    }],
    onDayUpdate: [({ role }) => {
      const targetRole = role.getPersistentTarget(FRAMER_TARGET_SLOT);
      if (role.victoryCondition || !targetRole || targetRole.player.isAlive) return;
      const next = findLivingTownTarget(role);
      if (!next) return;
      role.setPersistentTarget(FRAMER_TARGET_SLOT, next.role);
      dispatchNotice(
        role,
        actorNotice({
          key: MessageKey.FramerNewTarget,
          params: { targetName: next.username },
        }),
      );
    }],
    onPlayerVotedOut: [({ role, votedOut }) => {
      if (role.getPersistentTarget(FRAMER_TARGET_SLOT) === votedOut) {
        role.victoryCondition = true;
        dispatchNotice(role, actorNotice({ key: MessageKey.FramerTargetVotedOut }));
      }
    }],
  }),
} satisfies RoleDefinition;
