import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { createRoleHandlers } from "../../composition/handlers/types.js";
import { mafiaTraits, mafiaVoteHandler } from "./shared.js";

export const mafiaDefinition = {
  kind: "built-in",
  id: "mafia",
  metadata: {
    name: "Mafia",
    group: RoleGroup.Mafia,
    category: "mafia-killing",
    summary: "Standard mafia member.",
    description: "Votes as faction and can be picked as attacker.",
    isUnique: false,
  },
  balance: { power: -13 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: false,
    nightVisitFaction: false,
    nightVote: true,
  },
  traits: mafiaTraits,
  handlers: createRoleHandlers(mafiaVoteHandler()),
} satisfies RoleDefinition;
