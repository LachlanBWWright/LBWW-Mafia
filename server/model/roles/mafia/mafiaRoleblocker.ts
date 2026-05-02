import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { RoleMafia } from "./abstractMafiaRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

/**
 * A Mafia role with roleblocker abilities. Can block a player's action during the night phase,
 * preventing them from using their night ability.
 *
 * @class MafiaRoleblocker
 * @extends {RoleMafia}
 */

export class MafiaRoleblocker extends RoleMafia {
  name = "Mafia Roleblocker";
  group = RoleGroup.Mafia;
  baseDefence = CombatLevel.None;
  defence = CombatLevel.None;
  roleblocker = true;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = true;

  /**
   * Creates a new MafiaRoleblocker instance.
   *
   * @param room - The game room
   * @param player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the roleblocker to choose a player to block.
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
   * Performs the block visit by marking the target as roleblocked.
   * Blocks succeeds on Town targets; has a 50% chance to succeed on other roles.
   *
   * @returns
   */
  defaultVisit() {
    if (this.visiting === null) return;

    if (this.visiting.group === RoleGroup.Town || Math.random() > 0.5) {
      this.visiting.roleblocked = true;
      this.visiting.receiveVisit(this);
    }
  }
}
