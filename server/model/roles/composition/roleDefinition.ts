import type { CombatLevel } from "../combatLevel.js";
import type { RoleGroup } from "../roleGroup.js";
import type { RoleTrait } from "./roleTraits.js";
import {
  createRoleHandlers,
  type RoleCommandCallback,
  type RoleHandlerInput,
  type RoleHandlerBuckets,
  type RoleVoteCallback,
} from "./handlers/types.js";

export type RoleCapabilities = {
  dayVisitSelf: boolean;
  dayVisitOthers: boolean;
  dayVisitFaction: boolean;
  nightVisitSelf: boolean;
  nightVisitOthers: boolean;
  nightVisitFaction: boolean;
  nightVote: boolean;
};

export type RoleCapabilityFlags = {
  self: boolean;
  others: boolean;
  faction: boolean;
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
  handlers: RoleHandlerBuckets;
};

type RoleDefinitionCore = Omit<RoleDefinition, "capabilities" | "handlers">;

function createCapabilities(params: {
  day: RoleCapabilityFlags;
  night: RoleCapabilityFlags;
  nightVote: boolean;
}): RoleCapabilities {
  return {
    dayVisitSelf: params.day.self,
    dayVisitOthers: params.day.others,
    dayVisitFaction: params.day.faction,
    nightVisitSelf: params.night.self,
    nightVisitOthers: params.night.others,
    nightVisitFaction: params.night.faction,
    nightVote: params.nightVote,
  };
}

function createDefinition(
  params: RoleDefinitionCore & {
    capabilities: RoleCapabilities;
    handlers?: RoleHandlerInput;
  },
): RoleDefinition {
  return {
    ...params,
    handlers: createRoleHandlers(params.handlers),
  };
}

export function passiveRoleDefinition(params: RoleDefinitionCore & {
  handlers?: RoleHandlerInput;
}): RoleDefinition {
  return createDefinition({
    ...params,
    capabilities: createCapabilities({
      day: { self: false, others: false, faction: false },
      night: { self: false, others: false, faction: false },
      nightVote: false,
    }),
  });
}

export function dayActionRoleDefinition(params: RoleDefinitionCore & {
  day: RoleCapabilityFlags;
  onDayCommand: RoleCommandCallback;
  handlers?: RoleHandlerInput;
}): RoleDefinition {
  return createDefinition({
    ...params,
    capabilities: createCapabilities({
      day: params.day,
      night: { self: false, others: false, faction: false },
      nightVote: false,
    }),
    handlers: createRoleHandlers(
      { onDayCommand: [params.onDayCommand] },
      params.handlers,
    ),
  });
}

export function nightActionRoleDefinition(params: RoleDefinitionCore & {
  night: RoleCapabilityFlags;
  onNightCommand: RoleCommandCallback;
  handlers?: RoleHandlerInput;
}): RoleDefinition {
  return createDefinition({
    ...params,
    capabilities: createCapabilities({
      day: { self: false, others: false, faction: false },
      night: params.night,
      nightVote: false,
    }),
    handlers: createRoleHandlers(
      { onNightCommand: [params.onNightCommand] },
      params.handlers,
    ),
  });
}

export function nightVoteRoleDefinition(params: RoleDefinitionCore & {
  onNightVote: RoleVoteCallback;
  handlers?: RoleHandlerInput;
}): RoleDefinition {
  return createDefinition({
    ...params,
    capabilities: createCapabilities({
      day: { self: false, others: false, faction: false },
      night: { self: false, others: false, faction: false },
      nightVote: true,
    }),
    handlers: createRoleHandlers(
      { onNightVote: [params.onNightVote] },
      params.handlers,
    ),
  });
}

export function nightActionWithNightVoteRoleDefinition(
  params: RoleDefinitionCore & {
    night: RoleCapabilityFlags;
    onNightCommand: RoleCommandCallback;
    onNightVote: RoleVoteCallback;
    handlers?: RoleHandlerInput;
  },
): RoleDefinition {
  return createDefinition({
    ...params,
    capabilities: createCapabilities({
      day: { self: false, others: false, faction: false },
      night: params.night,
      nightVote: true,
    }),
    handlers: createRoleHandlers(
      { onNightVote: [params.onNightVote], onNightCommand: [params.onNightCommand] },
      params.handlers,
    ),
  });
}
