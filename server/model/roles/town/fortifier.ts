import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

export class Fortifier extends Role {
  playerFortified: Role | null = null;
  canFortify = true;

  name = "Fortifier";
  group = RoleGroup.Town;
  baseDefence = 0;
  defence = 0;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = true;
  nightVisitFaction = false;
  nightVote = false;

  constructor(room: Room, player: Player) {
    super(room, player);
  }

  handleNightAction(recipient: Player) {
    //Vote on who should be attacked
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot fortify your own house.",
      );
    } else if (
      recipient.username != undefined &&
      recipient.isAlive &&
      this.canFortify
    ) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to fortify " + recipient.username + "'s house.",
      );
      this.visiting = recipient.role;
    } else if (this.playerFortified != null) {
      if (
        recipient.username != undefined &&
        this.playerFortified.player.isAlive &&
        !this.canFortify
      ) {
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "You have chosen to try and remove " +
            this.playerFortified.player.username +
            "'s fortifications.",
        );
        this.visiting = recipient.role;
      } else {
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "You cannot remove the fortifications from a dead player's house.",
        );
      }
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Invalid choice.");
    }
  }

  visit() {
    //Builds the fortifications
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      if (this.canFortify) {
        //Builds fortifications
        this.canFortify = false;
        this.visiting.baseDefence += 2;
        this.playerFortified = this.visiting;
        io.to(this.playerFortified.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "Your house has been fortified!",
        );
      } else if (this.playerFortified !== null) {
        //Attempts to remove fortifications
        this.visiting.baseDefence -= 2;
        if (Math.random() > 0.5) {
          io.to(this.player.user.socketId).emit(
            ServerEvent.ReceiveMessage,
            "You died stripping the house of your fortifications.",
          );
          io.to(this.playerFortified.player.user.socketId).emit(
            ServerEvent.ReceiveMessage,
            `${this.playerFortified.player.username} died stripping your house of its fortifications.`,
          );
          this.damage = 999;
        } else {
          io.to(this.player.user.socketId).emit(
            ServerEvent.ReceiveMessage,
            "You stripped the house of its fortifications, and killed the owner.",
          );
          io.to(this.playerFortified.player.user.socketId).emit(
            ServerEvent.ReceiveMessage,
            "You died trying to stop your house from being stripped of its fortifications.",
          );
          this.playerFortified.damage = 999;
        }
      }
    }
  }

  handleVisits() {
    //Attacks the attackers of the fortified person's house
    if (this.playerFortified != null && this.visiting !== null) {
      for (const attacker of this.visiting.attackers) {
        if (
          attacker != this &&
          attacker != this.visiting
        ) {
          if (attacker.damage == 0) attacker.damage = 1;
          attacker.attackers.push(this);
        }
      }
    }
  }
}
