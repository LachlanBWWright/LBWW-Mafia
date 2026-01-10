import { type Player } from "../../player/player.js";
import { Role } from "../abstractRole.js";
import { BASIC_ATTACK_DAMAGE } from "../../../constants/gameConstants.js";
import { RoleGroup } from "../../../../shared/roles/roleEnums.js";

/**
 * Abstract base class for all Mafia faction roles
 *
 * Provides common functionality for mafia roles including:
 * - Coordinated faction attacks via voting
 * - Attack execution with basic damage
 * - Faction communication integration
 */
export abstract class RoleMafia extends Role {
  attackVote: Player | Role | null = null;
  isAttacking = false;

  group = RoleGroup.Mafia;

  handleNightVote(recipient: Player) {
    this.attackVote = recipient;
    if (
      this.attackVote.role.faction != this.faction &&
      this.attackVote.isAlive &&
      this.faction !== undefined
    ) {
      this.faction.sendMessage(
        `${this.player.playerUsername} has voted to attack ${this.attackVote.playerUsername}.`,
      );
      this.attackVote = this.attackVote.role; //uses role for easier visiting
    } else {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "Invalid Vote." },
      });
    }
  }

  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    this.handleNightVote(recipient);
  }

  cancelNightAction() {
    //Faction-based classes should override this function
    this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
      name: "receiveMessage",
      data: { message: "You have cancelled your class' nighttime action." },
    });
    this.visiting = null;
  }

  visit() {
    if (this.isAttacking) {
      this.visitOverride();
      this.isAttacking = false;
    } else {
      this.defaultVisit();
    }
  }

  //For when a member of the mafia attacks someone instead of using their special ability
  visitOverride() {
    // This visits a role and attacks them. this.visiting is dictated by the faction Class.
    if (this.visiting != null) {
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You have been chosen to do the mafia's dirty work." },
      });
      this.visiting.receiveVisit(this);
      if (this.visiting.damage == 0) this.visiting.damage = BASIC_ATTACK_DAMAGE; // Attacks the victim with basic damage
      this.visiting.attackers.push(this);
    }
  }

  // This should be overridden by child classes, unless they can only attack
  defaultVisit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      if (this.visiting.damage == 0) this.visiting.damage = BASIC_ATTACK_DAMAGE; // Attacks the victim with basic damage
      this.visiting.attackers.push(this);
    }
  }
}
