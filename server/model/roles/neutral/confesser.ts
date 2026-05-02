import { Player } from "../../player/player.js";
import { RoleGroup } from "../roleGroup.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { CombatLevel } from "../combatLevel.js";

/**
 * A neutral role that wins by confessing something during the game.
 * Has no actions and a passive victory condition.
 *
 * @class Confesser
 * @extends {Role}
 */

export class Confesser extends Role {
  victoryCondition: boolean = false;

  name = "Confesser";
  group = RoleGroup.Neutral;
  baseDefence = CombatLevel.Low;
  defence = CombatLevel.Low;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Confesser instance and registers itself with the room.
   *
   * @param room - The game room
   * @param player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
    this.victoryCondition = false;
    this.room.confesser = this;
  }
}
