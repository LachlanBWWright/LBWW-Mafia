import type { CombatLevel } from "../combatLevel.js";
import type { RoleGroup } from "../roleGroup.js";
import type { RoleTrait } from "./roleTraits.js";
import type { RoleHandlerDefinition } from "./handlers/types.js";

export type RoleCapabilities = {
  dayVisitSelf: boolean;
  dayVisitOthers: boolean;
  dayVisitFaction: boolean;
  nightVisitSelf: boolean;
  nightVisitOthers: boolean;
  nightVisitFaction: boolean;
  nightVote: boolean;
};

export type RoleDefinition = {
  kind: "built-in";
  id: string;
  metadata: {
    name: string;
    group: RoleGroup;
    category: string;
    summary: string;
    description: string;
    isUnique: boolean;
  };
  balance: {
    power: number;
  };
  combat: {
    baseDefence: CombatLevel;
  };
  capabilities: RoleCapabilities;
  traits: RoleTrait[];
  handlers: RoleHandlerDefinition[];
};
