//This is the base class for a role

import { Room } from "../rooms/room.js";
import { io } from "../../servers/socket.js";
import { Faction } from "../factions/abstractFaction.js";
import { Player } from "../player/player.js";
import { Jailor } from "./town/jailor.js";
import { fromThrowable } from "neverthrow";

export abstract class Role {
  room: Room;
  player: Player;

  abstract name: string;
  abstract group: string;
  faction?: Faction;

  abstract baseDefence: number;
  abstract defence: number;
  damage = 0;

  abstract dayVisitSelf: boolean;
  abstract dayVisitOthers: boolean;
  abstract dayVisitFaction: boolean;
  abstract nightVisitSelf: boolean;
  abstract nightVisitOthers: boolean;
  abstract nightVisitFaction: boolean;
  abstract nightVote: boolean;
  attackVote?: Player | Role | null;
  isAttacking?: boolean;
  isInsane?: boolean;
  victoryCondition?: boolean;

  dayVisiting: Role | null = null;
  roleblocking: Role | null = null;
  visiting: Role | null = null;
  visitors: Role[] = [];
  attackers: Role[] = [];

  abstract roleblocker: boolean;
  roleblocked = false;
  silenced = false;
  dayTapped: Role | boolean = false;
  nightTapped: Role | boolean = false;
  jailed: Jailor | null = null;

  // Role name, Group Name, SocketIo Room, Player Class, Base Defence, Is Roleblocker, Day visits, night visits
  constructor(room: Room, player: Player) {
    //Classes
    this.room = room; //io for SocketIo emitting
    this.player = player; //The player object paired to the class
  }

  assignFaction(faction: Faction) {
    this.faction = faction;
  }

  initRole() {
    //Initialises a role, overridden by child classes when required.
  }

  dayUpdate() {
    //Updates a role at the start of each day from day 2, overridden by child classes when required.
  }

  //Handles sending general message
  handleMessage(message: string) {
    if (this.room.time == "day") {
      //Free speaking only at daytime
      if (this.silenced)
        io.to(this.player.socketId).emit(
          "receive-chat-message",
          "You have been silenced and cannot talk",
        );
      else
        io.to(this.room.name).emit(
          "receive-chat-message",
          this.player.playerUsername + ": " + message,
        );
    } else if (this.jailed != null) {
      //Special logic for jailee-jailor messaging conversation
      io.to(this.player.socketId).emit(
        "receive-chat-message",
        this.player.playerUsername + ": " + message,
      );
      io.to(this.jailed.player.socketId).emit(
        "receive-chat-message",
        this.player.playerUsername + ": " + message,
      );
    } else if (this.name == "Jailor" && this.dayVisiting != null) {
      //Special logic for jailor => jailee messaging
      io.to(this.player.socketId).emit(
        "receive-chat-message",
        "Jailor: " + message,
      );
      io.to(this.dayVisiting.player.socketId).emit(
        "receive-chat-message",
        "Jailor: " + message,
      );
    } else if (typeof this.faction === "undefined") {
      //If the player isn't in a faction, they can't talk at night
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You cannot speak at night.",
      );
    } else {
      //Calls the function for handling the night chat.
      const handleNightMessage = fromThrowable(
        () => {
          this.faction.handleNightMessage(message, this.player.playerUsername);
          if (this.nightTapped != false && this.nightTapped !== true)
            io.to(this.nightTapped.player.socketId).emit(
              "receive-chat-message",
              this.player.playerUsername + ": " + message,
            );
        },
        (error) => error,
      );
      const result = handleNightMessage();

      if (result.isErr()) console.error(result.error);
    }
  }

  handleDayAction(_recipient: Player) {
    //Handles the class' daytime action
    io.to(this.player.socketId).emit(
      "receiveMessage",
      "Your class has no daytime action.",
    );
  }

  cancelDayAction() {
    //Faction-based classes should override this function
    io.to(this.player.socketId).emit(
      "receiveMessage",
      "You have cancelled your class' daytime action.",
    );
    this.dayVisiting = null;
  }

  handleNightAction(_recipient: Player) {
    //Handles the class' nighttime action
    io.to(this.player.socketId).emit(
      "receiveMessage",
      "Your class has no nighttime action.",
    );
  }

  handleNightVote(_recipient: Player) {
    io.to(this.player.socketId).emit(
      "receiveMessage",
      "Your class has no nighttime factional voting.",
    );
  }

  cancelNightAction() {
    //Faction-based classes should override this function
    io.to(this.player.socketId).emit(
      "receiveMessage",
      "You have cancelled your class' nighttime action.",
    );
    this.visiting = null;
  }

  receiveVisit(role: Role) {
    //Called by another player visiting at day
    this.visitors.push(role);
  }

  handleDamage() {
    //Kills the player if they don't have adequate defence, then resets attack/damage
    if (this.baseDefence > this.defence) this.defence = this.baseDefence;
    if (this.damage > this.defence) {
      //Kills the player
      io.to(this.player.socketId).emit("receiveMessage", "You have died!");
      io.to(this.player.socketId).emit("blockMessages");
      io.to(this.room.name).emit(
        "receiveMessage",
        this.player.playerUsername +
          " has died. Their role was " +
          this.name.toLowerCase() +
          ".",
      );
      this.player.isAlive = false;
      this.damage = 0; //Stops the player from being spammed with death messages after they die.
      this.attackers = [];

      io.to(this.room.name).emit("update-player-role", {
        name: this.player.playerUsername,
        role: this.name,
      });
      return true;
    }
    //Resets stats
    if (this.damage != 0)
      io.to(this.player.socketId).emit(
        "receiveMessage",
        "You were attacked, but you survived!",
      );
    this.defence = this.baseDefence;
    this.damage = 0;
    this.attackers = [];
    return false;
  }

  //These should be overriden by child classes if applicable
  dayVisit() {} //Visit another player (Day)
  visit() {} //Visit another player (Night)
  receiveDayVisit(_role: Role) {} //Called by another player visiting at night
  handleDayVisits() {} //Called after visit. For roles such as the watchman, who can see who has visited who
  handleVisits() {} //Called after visit. For roles such as the watchman, who can see who has visited who
}
