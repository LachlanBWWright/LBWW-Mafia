import { Room } from "../rooms/room.js";
import { io } from "../../servers/emitter.js";
import { Faction } from "../factions/abstractFaction.js";
import { Player } from "../player/player.js";
import { RoleGroup } from "./roleGroup.js";
import { CombatLevel } from "./combatLevel.js";
import { GamePhase } from "../rooms/gamePhase.js";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import type { RoleInterface } from "./roleInterface.js";

export class Role implements RoleInterface {
  readonly room: Room;
  readonly player: Player;

  name = "Role";
  group = RoleGroup.Unaligned;
  faction?: Faction;

  baseDefence = CombatLevel.None;
  defence = CombatLevel.None;
  damage = CombatLevel.None;

  dayVisitSelf = false;
  dayVisitOthers = false;
  dayVisitFaction = false;
  nightVisitSelf = false;
  nightVisitOthers = false;
  nightVisitFaction = false;
  nightVote = false;
  attackVote?: Role | null;
  isAttacking?: boolean;
  isInsane?: boolean;
  victoryCondition?: boolean;

  dayVisiting: Role | null = null;
  roleblocking: Role | null = null;
  visiting: Role | null = null;
  visitors: Role[] = [];
  attackers: Role[] = [];

  roleblocker = false;
  roleblocked = false;
  silenced = false;
  dayTapped: Role | boolean = false;
  nightTapped: Role | boolean = false;
  jailed: Role | null = null;

  /**
   * Creates a new Role instance.
   *
   * @param room - The game room this role belongs to
   * @param player - The player assigned to this role
   */
  constructor(room: Room, player: Player) {
    this.room = room;
    this.player = player;
  }

  /**
   * Assigns this role to a faction.
   *
   * @param faction - The faction to assign
   * @returns
   */
  assignFaction(faction: Faction) {
    this.faction = faction;
  }

  /**
   * Initializes the role at game start. Override in subclasses for role-specific setup.
   *
   * @returns
   */
  initRole() {}

  /**
   * Called at the start of each day phase. Override in subclasses for role-specific logic.
   *
   * @returns
   */
  dayUpdate() {}

  /**
   * Handles incoming chat messages based on the current game phase.
   * Silenced players are notified, day phase messages are broadcast, and night messages are faction-scoped.
   *
   * @param message - The chat message content
   * @returns
   */
  handleMessage(message: string) {
    const socketId = this.player.user.socketId;
    if (this.room.time === GamePhase.Day) {
      if (this.silenced) {
        io.to(socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.SilencedCannotTalk,
        });
      } else {
        io.to(this.room.name).emit(
          ServerEvent.ReceiveChatMessage,
          `${this.player.username}: ${message}`,
        );
      }
    } else if (this.jailed != null) {
      io.to(socketId).emit(
        ServerEvent.ReceiveChatMessage,
        `${this.player.username}: ${message}`,
      );
      io.to(this.jailed.player.user.socketId).emit(
        ServerEvent.ReceiveChatMessage,
        `${this.player.username}: ${message}`,
      );
    } else if (typeof this.faction === "undefined") {
      io.to(socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotSpeakAtNight,
      });
    } else {
      this.faction.handleNightMessage(message, this.player.username);
      if (this.nightTapped instanceof Role) {
        io.to(this.nightTapped.player.user.socketId).emit(
          ServerEvent.ReceiveChatMessage,
          `${this.player.username}: ${message}`,
        );
      }
    }
  }

  /**
   * Handles a daytime action on a target player. Override in subclasses for role-specific logic.
   * Default implementation sends a message indicating the role has no day action.
   *
   * @param _recipient - The target player (not used in base implementation)
   * @returns
   */
  handleDayAction(_recipient: Player) {
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.NoDayAction,
    });
  }

  /**
   * Cancels the player's current day action visit and notifies them.
   *
   * @returns
   */
  cancelDayAction() {
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.CancelledDayAction,
    });
    this.dayVisiting = null;
  }

  /**
   * Handles a nighttime action on a target player. Override in subclasses for role-specific logic.
   * Default implementation sends a message indicating the role has no night action.
   *
   * @param _recipient - The target player (not used in base implementation)
   * @returns
   */
  handleNightAction(_recipient: Player) {
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.NoNightAction,
    });
  }

  /**
   * Handles a nighttime factional vote. Override in subclasses for role-specific logic.
   * Default implementation sends a message indicating the role has no night voting.
   *
   * @param _recipient - The target player (not used in base implementation)
   * @returns
   */
  handleNightVote(_recipient: Player) {
    io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.NoNightVote,
    });
  }

  /**
   * Cancels the player's current night action visit and notifies them.
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
   * Registers that another role is visiting this role.
   *
   * @param role - The role that is visiting
   * @returns
   */
  receiveVisit(role: Role) {
    this.visitors.push(role);
  }

  /**
   * Processes incoming damage based on this role's defense.
   * If damage exceeds defense, the player dies. Otherwise, damage is reset at end of phase.
   * Notifies the player and broadcasts their death if applicable.
   *
   * @returns True if the player died, false otherwise
   */
  handleDamage() {
    if (this.baseDefence > this.defence) this.defence = this.baseDefence;
    if (this.damage > this.defence) {
      const socketId = this.player.user.socketId;
      io.to(socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.YouHaveDied,
      });
      io.to(socketId).emit(ServerEvent.BlockMessages);
      io.to(this.room.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.PlayerHasDied,
        params: {
          playerName: this.player.username,
          roleName: this.name.toLowerCase(),
        },
      });
      this.player.isAlive = false;
      this.damage = CombatLevel.None;
      this.attackers = [];
      io.to(this.room.name).emit(ServerEvent.UpdatePlayerRole, {
        name: this.player.username,
        role: this.name,
      });
      return true;
    }
    if (this.damage !== CombatLevel.None) {
      io.to(this.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.AttackedButSurvived,
      });
    }
    this.defence = this.baseDefence;
    this.damage = CombatLevel.None;
    this.attackers = [];
    return false;
  }

  /**
   * Processes daytime visits. Override in subclasses for role-specific logic.
   *
   * @returns
   */
  dayVisit() {}

  /**
   * Processes nighttime visits. Override in subclasses for role-specific logic.
   *
   * @returns
   */
  visit() {}

  /**
   * Called when another role visits this role during daytime. Override in subclasses for role-specific logic.
   *
   * @param _role - The role that is visiting
   * @returns
   */
  receiveDayVisit(_role: Role) {}

  /**
   * Processes all daytime visits to this role. Override in subclasses for role-specific logic.
   *
   * @returns
   */
  handleDayVisits() {}

  /**
   * Processes all nighttime visits to this role. Override in subclasses for role-specific logic.
   *
   * @returns
   */
  handleVisits() {}
}
