import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { RoleMafia } from "./abstractMafiaRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

/**
 * A Mafia role with investigation abilities. Can inspect other players to reveal their role
 * during the night phase instead of attacking.
 *
 * @class MafiaInvestigator
 * @extends {RoleMafia}
 */

export class MafiaInvestigator extends RoleMafia {
  name = "Mafia Investigator";
  group = RoleGroup.Mafia;
  baseDefence = CombatLevel.None;
  defence = CombatLevel.None;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = true;

  /**
   * Creates a new MafiaInvestigator instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action by allowing the investigator to choose a player to inspect.
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
   * Performs the inspection visit by revealing the target role to the investigator.
   *
   * @returns {void}
   */
  defaultVisit() {
    if (this.visiting === null) return;

    this.visiting.receiveVisit(this);
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.MafiaInvestigatorResult,
      params: {
        targetName: this.visiting.player.username,
        roleName: this.visiting.name,
      },
    });
  }
}
