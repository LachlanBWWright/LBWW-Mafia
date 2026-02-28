import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { io } from "../../../servers/emitter.js";

export abstract class RoleMafia extends Role {
  attackVote: Role | null = null;
  isAttacking = false;

  group = "mafia";

  constructor(room: Room, player: Player) {
    //Group is kept as a constructor parameter for consistency, but mafia classes will always be in the 'mafia' group.
    super(room, player);
  }

  handleNightVote(recipient: Player) {
    const recipientRole = recipient.role;
    if (
      recipient.playerUsername != undefined &&
      recipientRole?.faction != this.faction &&
      recipient.isAlive &&
      this.faction !== undefined
    ) {
      this.faction.sendMessage(
        this.player.playerUsername +
          " has voted to attack " +
          recipient.playerUsername +
          ".",
      );
      this.attackVote = recipientRole; //uses role for easier visiting
    } else {
      this.attackVote = null;
      io.to(this.player.socketId).emit("receiveMessage", "Invalid Vote.");
    }
  }

  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    this.handleNightVote(recipient);
  }

  cancelNightAction() {
    //Faction-based classes should override this function
    io.to(this.player.socketId).emit(
      "receiveMessage",
      "You have cancelled your class' nighttime action.",
    );
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

  //For when a member of the mafia attacks someone instead of
  visitOverride() {
    //This visits a role and attacks them. this.visiting is dictated by the faction Class.
    if (this.visiting != null) {
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You have been chosen to do the mafia's dirty work.",
      );
      this.visiting.receiveVisit(this);
      if (this.visiting.damage == 0) this.visiting.damage = 1; //Attacks the victim
      this.visiting.attackers.push(this);
    }
  }

  //This should be overriden by child classes, unless they can only attack
  defaultVisit() {
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      if (this.visiting.damage == 0) this.visiting.damage = 1; //Attacks the victim
      this.visiting.attackers.push(this);
    }
  }
}
