import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

/**
 * A neutral role that wins by getting a specific Town member voted out.
 * Automatically assigned a random Town target at game start. If the target dies before day 5,
 * a new target is assigned.
 *
 * @class Framer
 * @extends {Role}
 */

export class Framer extends Role {
  victoryCondition = false;
  /**
   * The Town player that the Framer is trying to get voted out.
   * @type {Player | null}
   */
  target: Player | null = null;

  name = "Framer";
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
   * Creates a new Framer instance and registers itself with the room.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
    this.room.framer = this;
  }

  /**
   * Initializes the Framer by selecting a random Town member as the target.
   * Notifies the Framer of their target and win condition.
   *
   * @returns {void}
   */
  initRole() {
    this.target = this.findRandomTownTarget();
    if (this.target) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.FramerTarget,
        params: { targetName: this.target.username },
      });
    }
  }

  /**
   * Updates the target if the current target dies before day 5.
   * Selects a new random Town member and notifies the Framer.
   *
   * @returns {void}
   */
  dayUpdate() {
    if (this.target?.isAlive || this.victoryCondition) return;

    this.target = this.findRandomTownTarget();
    if (this.target) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.FramerNewTarget,
        params: { targetName: this.target.username },
      });
    }
  }

  private findRandomTownTarget(): Player | null {
    const length = this.room.playerList.length;
    const index = Math.floor(Math.random() * length);

    for (let i = 0; i < length; i++) {
      const candidate = this.room.playerList[(index + i) % length];
      if (
        candidate.role.group === RoleGroup.Town &&
        candidate.isAlive
      ) {
        return candidate;
      }
    }

    return null;
  }
}
