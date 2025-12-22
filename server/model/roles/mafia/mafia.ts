import { type Player } from "../../player/player.js";
import { type Room } from "../../rooms/room.js";
import { RoleMafia } from "./abstractMafiaRole.js";
import { RoleName, RoleGroup } from "../../../../shared/roles/roleEnums.js";

export class Mafia extends RoleMafia {
  name = RoleName.Mafia;
  group = RoleGroup.Mafia;
  baseDefence = 0;
  defence = 0;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = true;

  constructor(room: Room, player: Player) {
    super(room, player);
  }
}
