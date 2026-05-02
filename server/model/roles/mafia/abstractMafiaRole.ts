import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { CombatLevel } from "../combatLevel.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";

export abstract class RoleMafia extends Role {
  attackVote: Role | null = null;
  isAttacking = false;

  group = RoleGroup.Mafia;

  /**
   * Creates a new RoleMafia instance. All Mafia roles belong to the Mafia role group.
   *
   * @param room - The game room
   * @param player - The player assigned this role
   */
  constructor(room: Room, player: Player) {
    super(room, player);
  }

  /**
   * Handles a night vote on a target player for mafia attack.
   * Validates that the target is alive, not in the same faction, and not the voter.
   * If valid, records the vote and notifies the faction; otherwise notifies the voter of an invalid vote.
   *
   * @param recipient - The target player to vote for
   * @returns
   */
  handleNightVote(recipient: Player) {
    const recipientRole = recipient.role;
    if (!this.isValidAttackVote(recipient, recipientRole)) {
      this.attackVote = null;
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.MafiaInvalidVote,
      });
      return;
    }

    if (this.faction !== undefined) {
      this.faction.sendMessage({
        key: MessageKey.MafiaVotedToAttack,
        params: {
          playerName: this.player.username,
          targetName: recipient.username,
        },
      });
    }
    this.attackVote = recipientRole;
  }

  private isValidAttackVote(
    recipient: Player,
    recipientRole: Role | null,
  ): boolean {
    return (
      recipient.username !== undefined &&
      recipientRole?.faction !== this.faction &&
      recipient.isAlive &&
      this.faction !== undefined
    );
  }

  /**
   * Handles a nighttime action by delegating to night vote logic.
   * Mafia members vote on their target instead of having independent actions.
   *
   * @param recipient - The target player
   * @returns
   */
  handleNightAction(recipient: Player) {
    this.handleNightVote(recipient);
  }

  /**
   * Cancels the current night action and notifies the player.
   *
   * @returns
   */
  cancelNightAction() {
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.CancelledNightAction,
    });
    this.visiting = null;
  }

  /**
   * Processes this role's nighttime visit.
   * If this role is attacking, performs an attack visit; otherwise performs a default visit.
   * Resets the attacking flag after processing.
   *
   * @returns
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
   * @returns
   */
  visitOverride() {
    if (this.visiting != null) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.MafiaChosenAttacker,
      });
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
   * @returns
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
