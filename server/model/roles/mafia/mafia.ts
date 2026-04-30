import { Player } from "../../player/player.js";
import { RoleGroup } from "../roleGroup.js";
import { Room } from "../../rooms/room.js";
import { RoleMafia } from "./abstractMafiaRole.js";
import { CombatLevel } from "../combatLevel.js";

/**
 * The base Mafia role. Participates in night attacks but has no special abilities.
 * Can only attack other players as part of the mafia faction.
 *
 * @class Mafia
 * @extends {RoleMafia}
 */
export class Mafia extends RoleMafia {
  name = "Mafia";
  group = RoleGroup.Mafia;
  baseDefence = CombatLevel.None;
  defence = CombatLevel.None;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = true;

  /**
   * Creates a new Mafia instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }
}
