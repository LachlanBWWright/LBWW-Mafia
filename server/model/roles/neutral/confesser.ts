import { Player } from "../../player/player.js";
import { RoleGroup } from "../roleGroup.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";

export class Confesser extends Role {
  victoryCondition: boolean = false;

  name = "Confesser";
  group = RoleGroup.Neutral;
  baseDefence = 1;
  defence = 1;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = false;

  constructor(room: Room, player: Player) {
    super(room, player);
    this.victoryCondition = false;
    this.room.confesser = this;
  }
}
