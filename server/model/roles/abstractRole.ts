import { Room } from "../rooms/room.js";
import { io } from "../../servers/emitter.js";
import { Faction } from "../factions/abstractFaction.js";
import { Player } from "../player/player.js";
import { RoleGroup } from "./roleGroup.js";
import { GamePhase } from "../rooms/gamePhase.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { fromThrowable } from "neverthrow";

export abstract class Role {
  readonly room: Room;
  readonly player: Player;

  abstract readonly name: string;
  abstract readonly group: RoleGroup;
  faction?: Faction;

  abstract baseDefence: number;
  defence = 0;
  damage = 0;

  abstract readonly dayVisitSelf: boolean;
  abstract readonly dayVisitOthers: boolean;
  abstract readonly dayVisitFaction: boolean;
  abstract readonly nightVisitSelf: boolean;
  abstract readonly nightVisitOthers: boolean;
  abstract readonly nightVisitFaction: boolean;
  abstract readonly nightVote: boolean;
  attackVote?: Role | null;
  isAttacking?: boolean;
  isInsane?: boolean;
  victoryCondition?: boolean;

  dayVisiting: Role | null = null;
  roleblocking: Role | null = null;
  visiting: Role | null = null;
  visitors: Role[] = [];
  attackers: Role[] = [];

  abstract readonly roleblocker: boolean;
  roleblocked = false;
  silenced = false;
  dayTapped: Role | boolean = false;
  nightTapped: Role | boolean = false;
  jailed: Role | null = null;

  constructor(room: Room, player: Player) {
    this.room = room;
    this.player = player;
  }

  assignFaction(faction: Faction) {
    this.faction = faction;
  }

  initRole() {}
  dayUpdate() {}

  handleMessage(message: string) {
    const socketId = this.player.user.socketId;
    if (this.room.time === GamePhase.Day) {
      if (this.silenced) {
        io.to(socketId).emit(ServerEvent.ReceiveChatMessage, "You have been silenced and cannot talk");
      } else {
        io.to(this.room.name).emit(
          ServerEvent.ReceiveChatMessage,
          `${this.player.username}: ${message}`,
        );
      }
    } else if (this.jailed != null) {
      io.to(socketId).emit(ServerEvent.ReceiveChatMessage, `${this.player.username}: ${message}`);
      io.to(this.jailed.player.user.socketId).emit(
        ServerEvent.ReceiveChatMessage,
        `${this.player.username}: ${message}`,
      );
    } else if (typeof this.faction === "undefined") {
      io.to(socketId).emit(ServerEvent.ReceiveMessage, "You cannot speak at night.");
    } else {
      const faction = this.faction;
      const handleNightMessage = fromThrowable(
        () => {
          faction.handleNightMessage(message, this.player.username);
          if (this.nightTapped instanceof Role) {
            io.to(this.nightTapped.player.user.socketId).emit(
              ServerEvent.ReceiveChatMessage,
              `${this.player.username}: ${message}`,
            );
          }
        },
        (error) => error,
      );
      const result = handleNightMessage();
      if (result.isErr()) console.error(result.error);
    }
  }

  handleDayAction(_recipient: Player) {
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Your class has no daytime action.");
  }

  cancelDayAction() {
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "You have cancelled your class' daytime action.");
    this.dayVisiting = null;
  }

  handleNightAction(_recipient: Player) {
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Your class has no nighttime action.");
  }

  handleNightVote(_recipient: Player) {
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "Your class has no nighttime factional voting.");
  }

  cancelNightAction() {
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "You have cancelled your class' nighttime action.");
    this.visiting = null;
  }

  receiveVisit(role: Role) {
    this.visitors.push(role);
  }

  handleDamage() {
    if (this.baseDefence > this.defence) this.defence = this.baseDefence;
    if (this.damage > this.defence) {
      const socketId = this.player.user.socketId;
      io.to(socketId).emit(ServerEvent.ReceiveMessage, "You have died!");
      io.to(socketId).emit(ServerEvent.BlockMessages);
      io.to(this.room.name).emit(
        ServerEvent.ReceiveMessage,
        `${this.player.username} has died. Their role was ${this.name.toLowerCase()}.`,
      );
      this.player.isAlive = false;
      this.damage = 0;
      this.attackers = [];
      io.to(this.room.name).emit(ServerEvent.UpdatePlayerRole, {
        name: this.player.username,
        role: this.name,
      });
      return true;
    }
    if (this.damage !== 0) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, "You were attacked, but you survived!");
    }
    this.defence = this.baseDefence;
    this.damage = 0;
    this.attackers = [];
    return false;
  }

  dayVisit() {}
  visit() {}
  receiveDayVisit(_role: Role) {}
  handleDayVisits() {}
  handleVisits() {}
}
