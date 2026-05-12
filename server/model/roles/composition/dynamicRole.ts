import type { Player } from "../../player/player.js";
import type { Room } from "../../rooms/room.js";
import type { CustomRoleDefinition } from "./types.js";
import { ComposedRole } from "./composedRole.js";
import { RoleFactory } from "./roleFactory.js";

export class DynamicRole extends ComposedRole {
  constructor(room: Room, player: Player, definition: CustomRoleDefinition) {
    super(RoleFactory.fromCustomDefinition(definition), room, player);
  }
}
