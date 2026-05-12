import type { Player } from "../../player/player.js";
import type { Room } from "../../rooms/room.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import type { RoleDefinition } from "./roleDefinition.js";
import { ComposedRole } from "./composedRole.js";

export type CustomRoleDefinition = {
  kind: "custom";
  id?: number;
  metadata: {
    name: string;
    faction: "town" | "mafia" | "neutral";
    category: string;
    summary: string;
    description: string;
    powerValue?: number;
    isUnique?: boolean;
    capabilities: {
      dayVisitSelf: boolean;
      dayVisitOthers: boolean;
      dayVisitFaction: boolean;
      nightVisitSelf: boolean;
      nightVisitOthers: boolean;
      nightVisitFaction: boolean;
    };
  };
  effects?: unknown;
};

export class RoleFactory {
  static createRole(definition: RoleDefinition, room: Room, player: Player): ComposedRole {
    return new ComposedRole(definition, room, player);
  }

  static fromCustomDefinition(definition: CustomRoleDefinition): RoleDefinition {
    const groupMap: Record<CustomRoleDefinition["metadata"]["faction"], RoleGroup> = {
      town: RoleGroup.Town,
      mafia: RoleGroup.Mafia,
      neutral: RoleGroup.Neutral,
    };

    return {
      kind: "built-in",
      id: `custom-${definition.id ?? definition.metadata.name.toLowerCase().replaceAll(/\s+/g, "-")}`,
      metadata: {
        name: definition.metadata.name,
        group: groupMap[definition.metadata.faction],
        category: definition.metadata.category,
        summary: definition.metadata.summary,
        description: definition.metadata.description,
        isUnique: definition.metadata.isUnique ?? false,
      },
      balance: { power: definition.metadata.powerValue ?? 0 },
      combat: { baseDefence: CombatLevel.None },
      capabilities: {
        dayVisitSelf: definition.metadata.capabilities.dayVisitSelf,
        dayVisitOthers: definition.metadata.capabilities.dayVisitOthers,
        dayVisitFaction: definition.metadata.capabilities.dayVisitFaction,
        nightVisitSelf: definition.metadata.capabilities.nightVisitSelf,
        nightVisitOthers: definition.metadata.capabilities.nightVisitOthers,
        nightVisitFaction: definition.metadata.capabilities.nightVisitFaction,
        nightVote: false,
      },
      traits: [],
      handlers: [],
    };
  }
}
