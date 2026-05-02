import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that blocks other players' night actions.
 * Successfully blocks all Town targets; has a 50% chance against other roles.
 *
 * @class Roleblocker
 * @extends {Role}
 */

export class Roleblocker extends Role {
  name = "Roleblocker";
  group = RoleGroup.Town;
  baseDefence = CombatLevel.None;
  defence = CombatLevel.None;
  roleblocker = true;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Roleblocker instance.
   *
   * @param room - The game room
   * @param player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Roleblocker to choose a player to block.
   * Validates that the target is not self and is alive.
   *
   * @param recipient - The target player to block
   * @returns
   */
  handleNightAction(recipient: Player) {
    if (recipient === this.player) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotBlockSelf,
      });
      return;
    }

    if (recipient.username !== undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.ChoseToBlock,
        params: { targetName: recipient.username },
      });
      this.visiting = recipient.role;
      return;
    }

    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.InvalidChoice,
    });
  }

  /**
   * Processes the block visit. Successfully blocks Town targets; 50% success chance on others.
   *
   * @returns
   */
  visit() {
    if (this.visiting === null) return;

    if (this.visiting.group === RoleGroup.Town || Math.random() > 0.5) {
      this.visiting.roleblocked = true;
      this.visiting.receiveVisit(this);
    }
  }
}
