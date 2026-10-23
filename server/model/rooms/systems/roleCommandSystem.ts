import type { Player } from "../../player/player.js";
import type { Room } from "../room.js";

export class RoleCommandSystem {
  constructor(private readonly _room: Room) {}

  runDayAction(actor: Player, recipient: Player): void {
    actor.role.handleDayAction(recipient);
  }

  runNightAction(actor: Player, recipient: Player): void {
    actor.role.handleNightAction(recipient);
  }

  runNightVote(actor: Player, recipient: Player): void {
    actor.role.handleNightVote(recipient);
  }
}
