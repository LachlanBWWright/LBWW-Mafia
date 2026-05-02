import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that judges players and determines their factional alignment.
 * Has a 70% chance to correctly identify alignment; otherwise returns a random alignment.
 *
 * @class Judge
 * @extends {Role}
 */

export class Judge extends Role {
  name = "Judge";
  group = RoleGroup.Town;
  baseDefence = CombatLevel.None;
  defence = CombatLevel.None;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Judge instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Judge to choose a player to inspect.
   * Validates that the target is not self and is alive.
   *
   * @param {Player} recipient - The target player to judge
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient === this.player) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.JudgeCannotInspectSelf,
      });
      return;
    }

    if (recipient.username !== undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.ChoseToInspect,
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
   * Processes the inspection visit by determining factional alignment.
   * Has a 30% chance to return false information; otherwise returns actual alignment.
   *
   * @returns {void}
   */
  visit() {
    if (this.visiting === null) return;

    this.visiting.receiveVisit(this);

    if (Math.random() < 0.3) {
      this.reportFalseAlignment();
    } else {
      this.reportTrueAlignment();
    }
  }

  private reportFalseAlignment(): void {
    if (!this.visiting) return;

    const livingPlayerList = this.room.playerList.filter(
      (player) => player.isAlive,
    );

    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.JudgeAlignmentResult,
      params: {
        targetName: this.visiting.player.username,
        factionName:
          livingPlayerList[Math.floor(Math.random() * livingPlayerList.length)]
            .role.group,
      },
    });
  }

  private reportTrueAlignment(): void {
    if (!this.visiting) return;

    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.JudgeAlignmentResult,
      params: {
        targetName: this.visiting.player.username,
        factionName: this.visiting.group,
      },
    });
  }
}
