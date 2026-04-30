import { Player } from "../player/player.js";
import { RoleGroup } from "./roleGroup.js";
import { CombatLevel } from "./combatLevel.js";
import { Room } from "../rooms/room.js";
import { Role } from "./abstractRole.js";

/**
 * A temporary placeholder role assigned to players before the game starts.
 * Has no special abilities or faction affiliation.
 *
 * @class BlankRole
 * @extends {Role}
 */
export class BlankRole extends Role {
  name = "Blank Role";
  group = RoleGroup.Unaligned;
  baseDefence = CombatLevel.None;
  defence = CombatLevel.None;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new BlankRole instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }
}
