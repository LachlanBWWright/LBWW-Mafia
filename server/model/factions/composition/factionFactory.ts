import type { Player } from "../../player/player.js";
import type { Room } from "../../rooms/room.js";
import type { FactionDefinition } from "./factionDefinition.js";
import { ComposedFaction } from "./composedFaction.js";

export class FactionFactory {
  static createFactions(
    room: Room,
    playerList: Player[],
    definitions: FactionDefinition[],
  ): ComposedFaction[] {
    return definitions
      .map((definition) => new ComposedFaction(definition, room))
      .filter((faction) => faction.hasMembers(playerList));
  }
}
