import { Role } from "../abstractRole.js";
import { Room } from "../../rooms/room.js";
import { Player } from "../../player/player.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";
import { fromThrowable } from "neverthrow";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";

/**
 * A Town role that researches players' backgrounds to discover their identities.
 * Has 3 research sessions. Each session reveals one of two randomly selected players'  roles
 * with 50% accuracy (may report the actual role or an incorrect one).
 *
 * @class Vetter
 * @extends {Role}
 */
export class Vetter extends Role {
  /**
   * Number of remaining research sessions for this Vetter.
   * @type {number}
   */
  researchSlots = 3;

  name = "Vetter";
  group = RoleGroup.Town;
  baseDefence = CombatLevel.None;
  defence = CombatLevel.None;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = true;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = false;

  /**
   * Creates a new Vetter instance.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles the night action to toggle research mode.
   * Consumes a research slot when activating research.
   * Must have research slots remaining to activate.
   *
   * @param {Player} _recipient - Not used; Vetter only affects self
   * @returns {void}
   */
  handleNightAction(_recipient: Player) {
    if (this.researchSlots == 0)
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have no research sessions left!",
      );
    else if (this.visiting == null) {
      this.visiting = this;
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have decided to stay home and research into people's history.",
      );
    } else {
      this.visiting = null;
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have decided not to research into people's history.",
      );
    }
  }

  /**
   * Processes the research visit by selecting two random players.
   * Reports one of the two players' roles with 50% chance of accuracy.
   * Decrements research slots and reports remaining sessions.
   *
   * @returns {void}
   */
  visit() {
    const visit = fromThrowable(
      () => {
        if (this.visiting === null) return;
        this.visiting.receiveVisit(this);
        this.researchSlots--;
        let randomPlayerOne = Math.floor(
          Math.random() * this.room.playerList.length,
        );
        let randomPlayerTwo = randomPlayerOne;
        while (
          randomPlayerTwo == randomPlayerOne &&
          this.room.playerList.length > 1
        )
          randomPlayerTwo = Math.floor(
            Math.random() * this.room.playerList.length,
          );

        if (Math.random() > 0.5) {
          io.to(this.player.user.socketId).emit(
            ServerEvent.ReceiveMessage,
            "You researched into " +
              this.room.playerList[randomPlayerOne].username +
              " and " +
              this.room.playerList[randomPlayerTwo].username +
              ", finding that at least one of them is a " +
              this.room.playerList[randomPlayerOne].role.name +
              ".",
          );
        } else {
          io.to(this.player.user.socketId).emit(
            ServerEvent.ReceiveMessage,
            "You researched into " +
              this.room.playerList[randomPlayerOne].username +
              " and " +
              this.room.playerList[randomPlayerTwo].username +
              ", finding that at least one of them is a " +
              this.room.playerList[randomPlayerTwo].role.name +
              ".",
          );
        }
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          `You have ${this.researchSlots} research sessions left.`,
        );
      },
      (error) => error,
    );
    const result = visit();

    if (result.isErr()) {
      console.error(result.error);
    }
  }
}
