import { type Player } from "../player/player.js";
import { type Room } from "../rooms/room.js";
import { Role } from "./abstractRole.js";
import { RoleName, RoleGroup } from "../../../shared/roles/roleEnums.js";

//To be used as a 'temp' role, assigned to users before the game has started

export class BlankRole extends Role {
  name = RoleName.BlankRole;
  group = RoleGroup.Unaligned;
  baseDefence = 0;
  defence = 0;
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
  }
}
