//This is the base class for a role

import { Room } from "../rooms/room.js";
import { Faction } from "../factions/abstractFaction.js";
import { Player } from "../player/player.js";
import { Jailor } from "./town/jailor.js";
import { RoleName } from "../../../shared/roles/roleEnums";
import { Time } from "../../../shared/socketTypes/socketTypes";

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
    if (this.room.time === Time.Day) {
      //Free speaking only at daytime
      if (this.silenced)
        this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
          name: "receive-chat-message",
          data: { message: "You have been silenced and cannot talk" },
        });
      else
        this.room.socketHandler.sendRoomMessage(this.room.name, {
          name: "receive-chat-message",
          data: { message: this.player.playerUsername + ": " + message },
        });
    } else if (this.jailed != null) {
      //Special logic for jailee-jailor messaging conversation
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receive-chat-message",
        data: { message: this.player.playerUsername + ": " + message },
      });
      this.room.socketHandler.sendPlayerMessage(this.jailed.player.socketId, {
        name: "receive-chat-message",
        data: { message: this.player.playerUsername + ": " + message },
      });
    } else if (this.name === RoleName.Jailor && this.dayVisiting != null) {
      //Special logic for jailor => jailee messaging
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receive-chat-message",
        data: { message: "Jailor: " + message },
      });
      this.room.socketHandler.sendPlayerMessage(
        this.dayVisiting.player.socketId,
        {
          name: "receive-chat-message",
          data: { message: "Jailor: " + message },
        },
      );
    } else if (typeof this.faction === "undefined") {
      //If the player isn't in a faction, they can't talk at night
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You cannot speak at night." },
      });
    } else {
      //Calls the function for handling the night chat.
      try {
        this.faction.handleNightMessage(message, this.player.playerUsername);
        if (this.nightTapped != false && this.nightTapped !== true)
          this.room.socketHandler.sendPlayerMessage(
            this.nightTapped.player.socketId,
            {
              name: "receive-chat-message",
              data: { message: this.player.playerUsername + ": " + message },
            },
          );
      } catch (error) {
        console.log(error);
      }
    }
  }

  handleDayAction(recipient: Player) {
    //Handles the class' daytime action
    this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
      name: "receiveMessage",
      data: { message: "Your class has no daytime action." },
    });
  }

  cancelDayAction() {
    //Faction-based classes should override this function
    this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
      name: "receiveMessage",
      data: { message: "You have cancelled your class' daytime action." },
    });
    this.dayVisiting = null;
  }

  handleNightAction(recipient: Player) {
    //Handles the class' nighttime action
    this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
      name: "receiveMessage",
      data: { message: "Your class has no nighttime action." },
    });
  }

  handleNightVote(recipient: Player) {
    this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
      name: "receiveMessage",
      data: { message: "Your class has no nighttime factional voting." },
    });
  }

  cancelNightAction() {
    //Faction-based classes should override this function
    this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
      name: "receiveMessage",
      data: { message: "You have cancelled your class' nighttime action." },
    });
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
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You have died!" },
      });
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "blockMessages",
      });
      this.room.socketHandler.sendRoomMessage(this.room.name, {
        name: "receiveMessage",
        data: {
          message:
            this.player.playerUsername +
            " has died. Their role was " +
            this.name.toLowerCase() +
            ".",
        },
      });
      this.player.isAlive = false;
      this.damage = 0; //Stops the player from being spammed with death messages after they die.
      this.attackers = [];

      this.room.socketHandler.sendRoomMessage(this.room.name, {
        name: "update-player-role",
        data: { name: this.player.playerUsername, role: this.name },
      });
      return true;
    }
    //Resets stats
    if (this.damage != 0)
      this.room.socketHandler.sendPlayerMessage(this.player.socketId, {
        name: "receiveMessage",
        data: { message: "You were attacked, but you survived!" },
      });
    this.defence = this.baseDefence;
    this.damage = 0;
    this.attackers = [];
    return false;
  }

  //These should be overriden by child classes if applicable
  dayVisit() {} //Visit another player (Day)
  visit() {} //Visit another player (Night)
  receiveDayVisit(role: Role) {} //Called by another player visiting at night
  handleDayVisits() {} //Called after visit. For roles such as the watchman, who can see who has visited who
  handleVisits() {} //Called after visit. For roles such as the watchman, who can see who has visited who
}
