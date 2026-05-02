import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

/**
 * A vigilante role that eliminates targets through sniping.
 * Kill amount varies based on the target's activity: 3 damage if the target didn't visit elsewhere,
 * 1 damage if visited the same target as before.
 *
 * @class Sniper
 * @extends {Role}
 */

export class Sniper extends Role {
  /**
   * The last role that was sniped to prevent consecutive kills on the same target.
   * @type {Role | null}
   */
  lastVisited: Role | null = null;

  name = "Sniper";
  group = RoleGroup.Sniper;
  baseDefence = CombatLevel.Low;
  defence = CombatLevel.Low;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Sniper instance.
   *
   * @param room - The game room
   * @param player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Sniper to choose a target to snipe.
   * Validates that the target is not self and is alive.
   *
   * @param recipient - The target player to snipe
   * @returns
   */
  handleNightAction(recipient: Player) {
    if (recipient === this.player) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.SniperCannotSnipeSelf,
      });
      return;
    }

    if (recipient.username !== undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.SniperChoseToSnipe,
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
   * Processes the visit, recording the target for damage calculation.
   *
   * @returns
   */
  visit() {
    if (this.visiting === null) {
      this.lastVisited = null;
      return;
    }

    this.visiting.receiveVisit(this);
  }

  /**
   * Calculates and applies damage based on the target's visit activity.
   * If the target did not visit elsewhere or self-visited: 3 damage.
   * If the target visited the same player as before: 1 damage.
   *
   * @returns
   */
  handleVisits() {
    if (this.visiting === null) return;

    if (
      this.visiting.visiting === this.visiting ||
      this.visiting.visiting === null
    ) {
      if (this.visiting.damage < CombatLevel.High) {
        this.visiting.damage = CombatLevel.High;
      }
    } else if (this.lastVisited === this.visiting) {
      if (this.visiting.damage === CombatLevel.None) {
        this.visiting.damage = CombatLevel.Low;
      }
    }

    this.lastVisited = this.visiting;
  }
}
