import { CombatLevel } from "../../combatLevel.js";
import { RoleGroup } from "../../roleGroup.js";
import type { RoleDefinition } from "../../composition/roleDefinition.js";

export const blankRoleDefinition = {
  kind: "built-in",
  id: "blank-role",
  metadata: {
    name: "Blank Role",
    group: RoleGroup.Unaligned,
    category: "system",
    summary: "Placeholder role.",
    description: "No actions.",
    isUnique: false,
  },
  balance: { power: 0 },
  combat: { baseDefence: CombatLevel.None },
  capabilities: {
    dayVisitSelf: false,
    dayVisitOthers: false,
    dayVisitFaction: false,
    nightVisitSelf: false,
    nightVisitOthers: false,
    nightVisitFaction: false,
    nightVote: false,
  },
  traits: [],
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
