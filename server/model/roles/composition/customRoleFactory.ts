import { Room } from "../../rooms/room.js";
import { Player } from "../../player/player.js";
import { DynamicRole } from "./dynamicRole.js";
import {
  ActionHandler,
  CustomRoleDefinition,
  RoleEffects,
  RoleMetadata,
} from "./types.js";
import {
  VisitActionHandler,
  ProtectiveActionHandler,
  AggressiveActionHandler,
  InvestigativeActionHandler,
  VoteActionHandler,
} from "./handlers.js";

/**
 * Factory for creating DynamicRole instances from custom role definitions.
 * Converts user-defined role configurations into composed role instances.
 */
export class CustomRoleFactory {
  /**
   * Creates a DynamicRole instance from a custom role definition.
   *
   * @param room - The game room
   * @param player - The player assigned this role
   * @param definition - The custom role definition
   * @returns Instantiated dynamic role
   */
  static createRole(
    room: Room,
    player: Player,
    definition: CustomRoleDefinition,
  ): DynamicRole {
    const handlers = this.buildHandlers(definition);
    return new DynamicRole(room, player, definition.metadata, handlers);
  }

  /**
   * Builds the action handler array from a custom role definition.
   * Maps metadata and effects to appropriate handler instances.
   *
   * @param def - The custom role definition
   * @returns Array of composed handlers
   */
  private static buildHandlers(def: CustomRoleDefinition): ActionHandler[] {
    const handlers: ActionHandler[] = [];
    const cap = def.metadata.capabilities;

    // Visit capabilities → handlers
    // Day phase visiting
    if (cap.dayVisitSelf) {
      handlers.push(new VisitActionHandler("day", "self"));
    }
    if (cap.dayVisitOthers) {
      handlers.push(new VisitActionHandler("day", "others"));
    }
    if (cap.dayVisitFaction) {
      handlers.push(new VisitActionHandler("day", "faction"));
    }

    // Night phase visiting
    if (cap.nightVisitSelf) {
      handlers.push(new VisitActionHandler("night", "self"));
    }
    if (cap.nightVisitOthers) {
      handlers.push(new VisitActionHandler("night", "others"));
    }
    if (cap.nightVisitFaction) {
      handlers.push(new VisitActionHandler("night", "faction"));
    }

    // Voting capability
    if (cap.dayVisitSelf || cap.dayVisitOthers || cap.dayVisitFaction) {
      // If they can visit during day, they can vote
      handlers.push(new VoteActionHandler(false));
    }

    // Effect handlers
    if (def.effects?.heal) {
      handlers.push(new ProtectiveActionHandler(def.effects.heal.defenseLevel));
    }

    if (def.effects?.damage) {
      handlers.push(new AggressiveActionHandler(def.effects.damage.level));
    }

    if (def.effects?.investigate) {
      handlers.push(
        new InvestigativeActionHandler(
          def.effects.investigate.type,
          def.effects.investigate.accuracyPercent,
        ),
      );
    }

    // Custom handler class if provided
    if (def.customHandlerClass) {
      handlers.push(new def.customHandlerClass());
    }

    return handlers;
  }

  /**
   * Creates a basic custom role definition from minimal configuration.
   * Useful for form-based custom role creation.
   *
   * @param config - Configuration object
   * @returns Custom role definition
   */
  static createBasicDefinition(config: {
    name: string;
    faction: "town" | "mafia" | "neutral";
    category: string;
    summary: string;
    description: string;
    powerValue: number;
    capabilities: RoleMetadata["capabilities"];
    effects?: RoleEffects;
  }): CustomRoleDefinition {
    return {
      metadata: {
        name: config.name,
        faction: config.faction,
        category: config.category,
        summary: config.summary,
        description: config.description,
        powerValue: config.powerValue,
        isUnique: false,
        capabilities: config.capabilities,
      },
      effects: config.effects,
    };
  }
}
