import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

export abstract class RoleMafia extends Role {
  attackVote: Role | null = null;
  isAttacking = false;

  group = RoleGroup.Mafia;

  /**
   * Creates a new RoleMafia instance. All Mafia roles belong to the Mafia role group.
   *
   * @param {Room} room - The game room
   * @param {Player} player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles a night vote on a target player for mafia attack.
   * Validates that the target is alive, not in the same faction, and not the voter.
   * If valid, records the vote and notifies the faction; otherwise notifies the voter of an invalid vote.
   *
   * @param {Player} recipient - The target player to vote for
   * @returns {void}
   */
  handleNightVote(recipient: Player) {
    const recipientRole = recipient.role;
    if (
      recipient.username != undefined &&
      recipientRole?.faction != this.faction &&
      recipient.isAlive &&
      this.faction !== undefined
    ) {
      this.faction.sendMessage(
        this.player.username +
          " has voted to attack " +
          recipient.username +
          ".",
      );
      this.attackVote = recipientRole;
    } else {
      this.attackVote = null;
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "Invalid Vote.",
      );
    }
  }

  /**
   * Handles a nighttime action by delegating to night vote logic.
   * Mafia members vote on their target instead of having independent actions.
   *
   * @param {Player} recipient - The target player
   * @returns {void}
   */
  handleNightAction(recipient: Player) {
    this.handleNightVote(recipient);
  }

  /**
   * Cancels the current night action and notifies the player.
   *
   * @returns {void}
   */
  cancelNightAction() {
    io.to(this.player.user.socketId).emit(
      ServerEvent.ReceiveMessage,
      "You have cancelled your class' nighttime action.",
    );
    this.visiting = null;
  }

  /**
   * Processes this role's nighttime visit.
   * If this role is attacking, performs an attack visit; otherwise performs a default visit.
   * Resets the attacking flag after processing.
   *
   * @returns {void}
   */
  visit() {
    if (this.isAttacking) {
      this.visitOverride();
      this.isAttacking = false;
    } else {
      this.defaultVisit();
    }
  }

  /**
   * Performs a mafia attack on the target role.
   * Notifies the player that they were selected for the attack and inflicts 1 damage.
   *
   * @returns {void}
   */
  visitOverride() {
    if (this.visiting != null) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have been chosen to do the mafia's dirty work.",
      );
      this.visiting.receiveVisit(this);
      if (this.visiting.damage == CombatLevel.None)
        this.visiting.damage = CombatLevel.Low;
      this.visiting.attackers.push(this);
    }
  }

  /**
   * Performs a default visit on the target role (usually an attack).
   * Should be overridden by subclasses that have role-specific abilities.
   * Default behavior inflicts 1 damage to the target.
   *
   * @returns {void}
   */
  defaultVisit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      if (this.visiting.damage == CombatLevel.None)
        this.visiting.damage = CombatLevel.Low;
      this.visiting.attackers.push(this);
    }
  }
}
