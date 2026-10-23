import type { Player } from "../../player/player.js";
import { RoleGroup } from "../../roles/roleGroup.js";

export function determineWinningFaction(players: readonly Player[]) {
  let survivingFaction = RoleGroup.Neutral;

  for (const player of players) {
    if (!player.isAlive || player.role.group === RoleGroup.Neutral) {
      continue;
    }

    if (survivingFaction === RoleGroup.Neutral) {
      survivingFaction = player.role.group;
      continue;
    }

    if (player.role.group !== survivingFaction) {
      return null;
    }
  }

  return survivingFaction;
}
