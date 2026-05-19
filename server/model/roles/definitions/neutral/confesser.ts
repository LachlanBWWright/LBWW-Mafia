import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";
import { RoleTrait } from "../../composition/roleTraits.js";

export const confesserDefinition = {
  kind: "built-in",
  id: "confesser",
  metadata: {
    name: "Confesser",
    group: RoleGroup.Neutral,
    category: "neutral-chaos",
    summary: "Wins when voted out.",
    description: "When voted out, disables further day voting.",
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
  traits: [RoleTrait.NeutralAligned, RoleTrait.Unique, RoleTrait.Confesser],
  handlers: {
    onAttach: [],
    onInit: [],
    onDayUpdate: [],
    onNightCleanup: [],
    onNoDeathDraw: [],
    onHandleMessage: [],
    onDayCommand: [],
    onNightCommand: [],
    onNightVote: [],
    onDayVisit: [],
    onNightVisit: [],
    onVisitOutcomes: [],
    onReceiveVisit: [],
    onPlayerVotedOut: [],
  },
} satisfies RoleDefinition;
