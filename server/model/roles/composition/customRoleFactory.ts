import type { Player } from "../../player/player.js";
import type { Room } from "../../rooms/room.js";
import type { CustomRoleDefinition } from "./types.js";
import { RoleFactory } from "./roleFactory.js";

export class CustomRoleFactory {
  static toRoleDefinition(definition: CustomRoleDefinition) {
    return RoleFactory.fromCustomDefinition(definition);
  }

  static createRole(room: Room, player: Player, definition: CustomRoleDefinition) {
    return RoleFactory.createRole(this.toRoleDefinition(definition), room, player);
  }
}
