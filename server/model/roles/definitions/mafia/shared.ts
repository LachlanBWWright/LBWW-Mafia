import { MessageKey } from "@mernmafia/shared/communication/messages";
import { RoleTrait } from "../../composition/roleTraits.js";
import type { RoleHandlerInput } from "../../composition/handlers/types.js";
import {
  addAttacker,
  applyDamageMinimum,
  registerNightVisit,
} from "../../composition/handlers/effects.js";
import {
  actorNotice,
  dispatchNotice,
  factionNotice,
} from "../../composition/handlers/notices.js";
import { accepted, rejected } from "../../composition/handlers/results.js";

export const mafiaTraits = [
  RoleTrait.MafiaAligned,
  RoleTrait.MafiaFactionMember,
  RoleTrait.CanBeMafiaAttacker,
];

export function mafiaVoteHandler(): RoleHandlerInput {
  return {
    onNightVote: [({ role, recipient }) => {
      if (
        !role.faction ||
        !recipient.isAlive ||
        recipient.role.faction === role.faction
      ) {
        role.attackVote = null;
        dispatchNotice(role, actorNotice({ key: MessageKey.MafiaInvalidVote }));
        return rejected;
      }
      role.faction.recordNightVote(role, recipient.role);
      dispatchNotice(
        role,
        factionNotice({
          key: MessageKey.MafiaVotedToAttack,
          params: {
            playerName: role.player.username,
            targetName: recipient.username,
          },
        }),
      );
      return accepted;
    }],
    onNightVisit: [({ role }) => {
      const factionAction = role.consumeFactionAction("attack");
      if (!factionAction || factionAction.kind !== "attack") return;
      const target = registerNightVisit(role);
      if (!target) return;
      dispatchNotice(role, actorNotice({ key: MessageKey.MafiaChosenAttacker }));
      applyDamageMinimum(target, factionAction.damage);
      addAttacker(target, role);
    }],
  };
}
