import type { RoleInstance } from "../../composition/roleInstance.js";
import { RoleGroup } from "../../roleGroup.js";

export const SNIPER_LAST_VISITED_SLOT = "sniper-last-visited";
export const FRAMER_TARGET_SLOT = "framer-current-target";

export function findLivingTownTarget(role: RoleInstance) {
  return role.room.playerList.find(
    (candidate) => candidate.isAlive && candidate.role.group === RoleGroup.Town,
  );
}
