import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

/**
 * A Town role that inspects players and guesses their role.
 * Provides three possible role guesses with 30% chance of accuracy.
 *
 * @class Investigator
 * @extends {Role}
 */

export class Investigator extends Role {
  name = "Investigator";
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
   * Creates a new Investigator instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the Investigator to choose a player to inspect.
   * Validates that the target is not self and is alive.
   *
   * @param {Player} recipient - The target player to inspect
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    if (recipient === this.player) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotInspectSelf,
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
   * Processes the inspection visit by generating three role guesses.
   * Each guess has a 30% chance of being the actual target role; otherwise a random role.
   *
   * @returns {void}
   */
  visit() {
    if (this.visiting === null) return;

    this.visiting.receiveVisit(this);
    const possibleRoles = this.generateRoleGuesses();

    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.InvestigatorResult,
      params: {
        targetName: this.visiting.player.username,
        role1: possibleRoles[0],
        role2: possibleRoles[1],
        role3: possibleRoles[2],
      },
    });
  }

  private generateRoleGuesses(): string[] {
    const guesses: string[] = [];
    for (let i = 0; i < 3; i++) {
      guesses.push(this.getRoleGuess());
    }
    return guesses;
  }

  private getRoleGuess(): string {
    if (!this.visiting) return "";

    if (Math.random() < 0.3) {
      return this.visiting.name;
    }

    const randomPlayer =
      this.room.playerList[
        Math.floor(Math.random() * this.room.playerList.length)
      ];
    return randomPlayer.role.name;
  }
}
