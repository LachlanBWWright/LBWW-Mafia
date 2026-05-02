import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";

/**
 * A Town role that watches other players to see who visits them at night.
 * Reports visitor information with varying accuracy based on visitor count:
 * - No visitors: Reports that nobody visited
 * - One visitor: Reveals the visitor's identity (or a false lead if random check)
 * - Multiple visitors: Lists all live visitors (or provides names with 50% chance of alibi)
 *
 * @class Watchman
 * @extends {Role}
 */

export class Watchman extends Role {
  name = "Watchman";
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
   * Creates a new Watchman instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Watchman to choose a player to watch.
   * Validates that the target is not self and is alive.
   *
   * @param {Player} recipient - The target player to watch
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.WatchmanCannotWatchSelf,
      });
      return;
    }

    if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.WatchmanChoseToWatch,
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
   * Processes the watch visit by registering as a visitor.
   *
   * @returns {void}
   */
  visit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
    }
  }

  /**
   * Processes visitor information and reports to the Watchman.
   * Handles different cases based on number of visitors:
   * - 1 visitor (only Watchman): Reports nobody visited
   * - 2 visitors (Watchman + 1): Reveals the visitor (or false lead)
   * - 3+ visitors: Lists all or provides alibi option
   *
   * @returns {void}
   */
  handleVisits() {
    if (this.visiting === null) return;
    this.processVisitors();
  }

  private processVisitors(): void {
    if (!this.visiting) return;

    const visitorCount = this.visiting.visitors.length;

    if (visitorCount === 1) {
      this.reportNobodyVisited();
    } else if (visitorCount === 2) {
      this.reportOneVisitor();
    } else {
      this.reportMultipleVisitors();
    }
  }

  private reportNobodyVisited(): void {
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.WatchmanNobodyVisited,
    });
  }

  private reportOneVisitor(): void {
    if (!this.visiting) return;

    const alibi = this.room.playerList[
      Math.floor(Math.random() * this.room.playerList.length)
    ].role;
    const isValidAlibi = this.isValidAlibi(alibi);

    if (!isValidAlibi) {
      this.reportRealVisitor();
    } else {
      this.reportAlibiOrReal(alibi);
    }
  }

  private isValidAlibi(alibi: Role): boolean {
    if (!this.visiting) return false;
    return (
      alibi.player.isAlive &&
      alibi !== this.visiting.visitors[0] &&
      alibi !== this.visiting.visitors[1] &&
      alibi !== this.visiting
    );
  }

  private reportRealVisitor(): void {
    if (!this.visiting) return;

    const realVisitor =
      this.visiting.visitors[0] === this
        ? this.visiting.visitors[1]
        : this.visiting.visitors[0];

    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.WatchmanTargetVisitedBy,
      params: {
        targetName: realVisitor.player.username,
      },
    });
  }

  private reportAlibiOrReal(alibi: Role): void {
    if (!this.visiting) return;

    const realVisitor =
      this.visiting.visitors[0] === this
        ? this.visiting.visitors[1]
        : this.visiting.visitors[0];

    const [name1, name2] =
      Math.random() > 0.5
        ? [realVisitor.player.username, alibi.player.username]
        : [alibi.player.username, realVisitor.player.username];

    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.WatchmanTargetVisitedByTwo,
      params: { name1, name2 },
    });
  }

  private reportMultipleVisitors(): void {
    if (!this.visiting) return;

    const visitorList = this.visiting.visitors
      .filter((visitor) => visitor.player.isAlive && visitor !== this)
      .map((visitor) => visitor.player.username);

    const lastEntry = visitorList[visitorList.length - 1] ?? "";
    const list =
      visitorList.length > 1
        ? visitorList.slice(0, -1).join(", ") + ", and " + lastEntry
        : lastEntry;

    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.WatchmanVisitorList,
      params: { list },
    });
  }
}
