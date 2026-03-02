import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { Role } from "../abstractRole.js";
import { RoleGroup } from "../roleGroup.js";
import { GamePhase } from "../../rooms/gamePhase.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { io } from "../../../servers/emitter.js";

export class Jailor extends Role {
  name = "Jailor";
  group = RoleGroup.Town;
  baseDefence = 0;
  defence = 0;
  roleblocker = false;
  dayVisitSelf = false;
  dayVisitOthers = true;
  dayVisitFaction = false;
  nightVisitSelf = true;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = false;

  constructor(room: Room, player: Player) {
    super(room, player);
  }

  handleMessage(message: string) {
    const socketId = this.player.user.socketId;
    if (this.room.time === GamePhase.Day) {
      super.handleMessage(message);
    } else if (this.dayVisiting != null) {
      io.to(socketId).emit(ServerEvent.ReceiveChatMessage, `Jailor: ${message}`);
      io.to(this.dayVisiting.player.user.socketId).emit(
        ServerEvent.ReceiveChatMessage,
        `Jailor: ${message}`,
      );
    } else {
      super.handleMessage(message);
    }
  }

  handleDayAction(recipient: Player) {
    //Choose to jail a player
    if (recipient == this.player) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You cannot jail yourself.",
      );
    } else if (recipient.username != undefined && recipient.isAlive) {
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have chosen to jail " + recipient.username + ".",
      );
      this.dayVisiting = recipient.role;
    } else {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Invalid choice.");
    }
  }

  handleNightAction(_recipient: Player) {
    //Choose if the player who is jailed should be executed, or let go
    if (this.dayVisiting == null) {
      //this.visiting = this;
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You haven't jailed anyone, so you cannot do anything.",
      );
    } else {
      if (this.visiting == null) {
        //To be exectued
        this.visiting = this.dayVisiting;
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "You have decided to execute the prisoner.",
        );
        io.to(this.dayVisiting.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "The jailor has decided to execute you",
        );
      } else {
        //Cancels the execution
        this.visiting = null;
        io.to(this.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "You have decided not to execute the prisoner.",
        );
        io.to(this.dayVisiting.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          "The jailor has decided not to execute you",
        );
      }
    }
  }

  dayVisit() {
    //Tells the player that they've been jailed, and roleblocks them. dayVisiting is called at the end of a day session.
    if (this.dayVisiting != null) {
      io.to(this.dayVisiting.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have been jailed!",
      );
      io.to(this.player.user.socketId).emit(
        ServerEvent.ReceiveMessage,
        "You have jailed your target.",
      );
      this.dayVisiting.jailed = this;
      this.dayVisiting.roleblocked = true;
    }
  }

  visit() {
    //Executes the player being jailed
    if (this.visiting != null) {
      this.visiting.receiveVisit(this);
      if (this.visiting.damage < 3) this.visiting.damage = 3; //Attacks the victim
      this.visiting.attackers.push(this);
    }
  }

  handleVisits() {
    if (this.dayVisiting != null) this.dayVisiting.jailed = null; //Resets if the victim has been jailed
    if (this.dayVisiting != null) {
      //Protect the jailee if they weren't executed
      if (this.dayVisiting.baseDefence == 0) this.dayVisiting.defence = 1;
    }
  }
}
