import Crypto from "crypto";
import { RoleHandler } from "./initRoles/roleHandler.js";
import { User } from "../user/user.js";
import { Player } from "../player/player.js";
import type { GamePlayerSocket } from "@mernmafia/shared/communication/serverTypes";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { DayTime } from "@mernmafia/shared/communication/events";
import { io } from "../../servers/emitter.js";
import { Confesser } from "../roles/neutral/confesser.js";
import { Faction } from "../factions/abstractFaction.js";
import { BlankRole } from "../roles/blankRole.js";
import { Role } from "../roles/abstractRole.js";
import { Framer } from "../roles/neutral/framer.js";
import { Peacemaker } from "../roles/neutral/peacemaker.js";
import { RoleGroup } from "../roles/roleGroup.js";
import { GamePhase } from "./gamePhase.js";
import { names } from "../player/names/namesList.js";
import { fromThrowable } from "neverthrow";
import {
  persistMatchHistory,
  rotateActiveRoom,
  type MatchHistoryEvent,
} from "../../data/matchHistory.js";

export class Room {
  readonly name: string;
  readonly size: number;

  /** Users connected in the lobby (before the game starts). */
  userList: User[] = [];
  /** Players active in the game. Populated from userList when the game starts. */
  playerList: Player[] = [];

  started = false;
  time: GamePhase = GamePhase.Idle;
  roleList: (typeof BlankRole)[] = [];
  factionList: Faction[] = [];
  sessionLength: number;
  gameHasEnded = false;
  endDay = 3;

  framer: Framer | null = null;
  confesserVotedOut = false;
  peacemaker: Peacemaker | null = null;
  confesser?: Confesser;

  startedAt = new Date();
  conversationHistory: MatchHistoryEvent[] = [];
  actionHistory: MatchHistoryEvent[] = [];

  constructor(size: number, name?: string) {
    this.name = name ?? Crypto.randomBytes(8).toString("hex");
    this.size = size;
    this.sessionLength = this.size * 4000;
  }

  private recordConversation(
    content: string,
    actor?: string,
    target?: string,
    type: MatchHistoryEvent["type"] = "chat",
  ) {
    this.conversationHistory.push({ time: Date.now(), type, actor, target, content });
  }

  private recordAction(content: string, actor?: string, target?: string) {
    this.actionHistory.push({ time: Date.now(), type: "action", actor, target, content });
  }

  private runSafely(action: () => void) {
    const safeAction = fromThrowable(action, (error) => error);
    const result = safeAction();
    if (result.isErr()) console.error(result.error);
  }

  /** Returns the active Player for a given socket, or null if not found. */
  private getPlayerFromSocket(socket: GamePlayerSocket): Player | null {
    if (socket.data.position === undefined) return null;
    const user = this.userList[socket.data.position];
    if (!user) return null;
    return this.playerList.find((p) => p.user === user) ?? null;
  }

  /**
   * Adds a connected client to the lobby.
   * Returns an error code on failure or the assigned username on success.
   */
  addUser(playerSocket: GamePlayerSocket): string | number {
    const socketId = playerSocket.id;
    if (this.userList.some((u) => u.socketId === socketId)) return 1;
    if (this.userList.length >= this.size) return 3;

    const takenNames = this.userList.map((u) => u.username);
    const username = names.find((n) => !takenNames.includes(n));
    if (!username) return 1;

    const user = new User(playerSocket, username);
    const position = this.userList.push(user) - 1;
    playerSocket.data.position = position;

    this.emitUserList(socketId);
    io.to(this.name).emit(ServerEvent.ReceiveMessage, `${username} has joined the room!`);
    this.recordConversation(`${username} has joined the room!`, username);
    io.to(this.name).emit(ServerEvent.ReceiveNewPlayer, { name: username });

    if (this.userList.length === this.size) {
      this.started = true;
      io.to(this.name).emit(ServerEvent.ReceiveMessage, "The room is full! Starting the game!");
      this.emitUserList(this.name);
      void rotateActiveRoom().catch((error) => {
        console.error("Failed to rotate active room", error);
      });
      this.startGame();
    }

    return username;
  }

  /** Handles a connected user leaving (pre-game removal or in-game death by abandonment). */
  removePlayer(socketId: string) {
    if (this.gameHasEnded) return;

    if (!this.started) {
      const index = this.userList.findIndex((u) => u.socketId === socketId);
      if (index === -1) return;
      const user = this.userList[index];
      io.to(this.name).emit(ServerEvent.RemovePlayer, { name: user.username });
      io.to(this.name).emit(ServerEvent.ReceiveMessage, `${user.username} has left the room!`);
      this.recordConversation(`${user.username} has left the room!`, user.username);
      this.userList.splice(index, 1);
      for (const [i, u] of this.userList.entries()) {
        u.socket.data.position = i;
      }
    } else {
      const player = this.playerList.find((p) => p.user.socketId === socketId);
      if (!player) return;
      io.to(this.name).emit(ServerEvent.ReceiveMessage, `${player.username} has abandoned the game!`);
      player.role.damage = 999;
    }
  }

  emitUserList(target: string) {
    const list = this.userList.map((u) => {
      const player = this.playerList.find((p) => p.user === u);
      return {
        name: u.username,
        isAlive: this.started ? (player?.isAlive ?? false) : undefined,
        role: this.started && player && !player.isAlive ? player.role.name : undefined,
      };
    });
    io.to(target).emit(ServerEvent.ReceivePlayerList, list);
  }

  handleSentMessage(playerSocket: GamePlayerSocket, message: string, isDay: boolean) {
    const handle = fromThrowable(() => {
      if (
        (!isDay && this.time === GamePhase.Day) ||
        (isDay && this.time === GamePhase.Night) ||
        playerSocket.data.position === undefined
      ) return;

      if (this.started) {
        const player = this.getPlayerFromSocket(playerSocket);
        if (!player) return;
        if (player.isAlive) {
          player.role.handleMessage(message);
        } else {
          io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, "You cannot speak, as you are dead.");
        }
        this.recordConversation(message, player.username);
      } else {
        const user = this.userList[playerSocket.data.position];
        if (!user) return;
        io.to(this.name).emit(ServerEvent.ReceiveChatMessage, `${user.username}: ${message}`);
        this.recordConversation(message, user.username);
      }
    }, (error) => error);

    const result = handle();
    if (result.isErr()) {
      io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, "You cannot speak, as you are dead. Or an error occured.");
      console.error(result.error);
    }
  }

  handleVote(playerSocket: GamePlayerSocket, recipient: number, isDay: boolean) {
    this.runSafely(() => {
      if (
        (!isDay && this.time === GamePhase.Day) ||
        (isDay && this.time === GamePhase.Night) ||
        this.time === GamePhase.Idle ||
        playerSocket.data.position === undefined
      ) return;

      const foundPlayer = this.getPlayerFromSocket(playerSocket);
      const foundRecipient = this.playerList[recipient];
      if (!foundPlayer || !foundRecipient) return;

      if (foundPlayer.hasVoted) {
        io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, "You cannot change your vote.");
      } else if (foundPlayer === foundRecipient) {
        io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, "You cannot vote for yourself.");
      } else if (this.time !== GamePhase.Day) {
        if (foundPlayer.role.nightVote) {
          foundPlayer.hasVoted = true;
          foundPlayer.role.handleNightVote(foundRecipient);
        } else {
          io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, "You cannot vote at night.");
        }
      } else if (this.confesserVotedOut) {
        io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, "The town voted out a confessor, disabling voting.");
      } else if (foundRecipient.isAlive && !foundPlayer.hasVoted) {
        this.recordAction("vote", foundPlayer.username, foundRecipient.username);
        foundPlayer.hasVoted = true;
        foundRecipient.votesReceived++;
        const voteMsg =
          foundRecipient.votesReceived > 1
            ? `${foundPlayer.username} has voted for ${foundRecipient.username} to be executed! There are ${foundRecipient.votesReceived} votes for ${foundRecipient.username} to be killed.`
            : `${foundPlayer.username} has voted for ${foundRecipient.username} to be executed! There is 1 vote for ${foundRecipient.username} to be killed.`;
        io.to(this.name).emit(ServerEvent.ReceiveMessage, voteMsg);
      } else {
        io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, "Your vote was invalid.");
      }
    });
  }

  handleWhisper(playerSocket: GamePlayerSocket, recipient: number, message: string, isDay: boolean) {
    this.runSafely(() => {
      if (
        (!isDay && this.time === GamePhase.Day) ||
        (isDay && this.time === GamePhase.Night) ||
        this.time === GamePhase.Idle ||
        playerSocket.data.position === undefined
      ) return;

      const foundPlayer = this.getPlayerFromSocket(playerSocket);
      const foundRecipient = this.playerList[recipient];
      if (!foundPlayer || !foundRecipient) return;

      if (this.time === GamePhase.Night) {
        io.to(foundPlayer.user.socketId).emit(ServerEvent.ReceiveMessage, "You cannot whisper at night.");
      } else if (this.time === GamePhase.Day && foundRecipient.isAlive) {
        this.recordAction("whisper", foundPlayer.username, foundRecipient.username);
        if (0.1 > Math.random()) {
          io.to(foundPlayer.user.socketId).emit(ServerEvent.ReceiveMessage, "Your whispers were overheard by the town!");
          io.to(this.name).emit(
            ServerEvent.ReceiveMessage,
            `${foundPlayer.username} tried to whisper "${message}" to ${foundRecipient.username}, but was overheard by the town!`,
          );
        } else {
          io.to(foundRecipient.user.socketId).emit(
            ServerEvent.ReceiveWhisperMessage,
            `Whisper from ${foundPlayer.username}: ${message}`,
          );
          this.recordConversation(message, foundPlayer.username, foundRecipient.username, "whisper");
          io.to(foundPlayer.user.socketId).emit(
            ServerEvent.ReceiveWhisperMessage,
            `Whisper to ${foundRecipient.username}: ${message}`,
          );
          const senderTap = foundPlayer.role.dayTapped;
          if (senderTap instanceof Role) {
            io.to(senderTap.player.user.socketId).emit(
              ServerEvent.ReceiveWhisperMessage,
              `${foundPlayer.username} whispered "${message}" to ${foundRecipient.username}.`,
            );
          }
          const recipientTap = foundRecipient.role.dayTapped;
          if (recipientTap instanceof Role) {
            io.to(recipientTap.player.user.socketId).emit(
              ServerEvent.ReceiveWhisperMessage,
              `${foundPlayer.username} whispered "${message}" to ${foundRecipient.username}.`,
            );
          }
        }
      } else {
        io.to(foundPlayer.user.socketId).emit(ServerEvent.ReceiveMessage, "You didn't whisper to a valid recipient, or they are dead.");
      }
    });
  }

  handleVisit(playerSocket: GamePlayerSocket, recipient: number | null, isDay: boolean) {
    this.runSafely(() => {
      if (
        (!isDay && this.time === GamePhase.Day) ||
        (isDay && this.time === GamePhase.Night) ||
        this.time === GamePhase.Idle ||
        playerSocket.data.position === undefined
      ) return;

      const foundPlayer = this.getPlayerFromSocket(playerSocket);
      const foundRecipient = recipient !== null ? this.playerList[recipient] : null;
      if (!foundPlayer) return;

      if (this.time === GamePhase.Day) {
        if (foundRecipient != null) {
          this.recordAction("day-visit", foundPlayer.username, foundRecipient.username);
          foundPlayer.role.handleDayAction(foundRecipient);
        } else {
          foundPlayer.role.cancelDayAction();
        }
      } else if (this.time === GamePhase.Night) {
        if (foundPlayer.role.roleblocked) {
          io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, "You are roleblocked, and cannot call commands.");
        } else if (foundRecipient != null) {
          this.recordAction("night-visit", foundPlayer.username, foundRecipient.username);
          foundPlayer.role.handleNightAction(foundRecipient);
        } else {
          foundPlayer.role.cancelNightAction();
        }
      }
    });
  }

  async startGame() {
    const roleHandler = new RoleHandler(this.userList.length);
    this.roleList.push(...roleHandler.assignGame());

    let currentIndex = this.roleList.length;
    while (currentIndex !== 0) {
      const randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [this.roleList[currentIndex], this.roleList[randomIndex]] = [
        this.roleList[randomIndex],
        this.roleList[currentIndex],
      ];
    }

    for (const [index, user] of this.userList.entries()) {
      user.socket.data.position = index;
      const player = new Player(user);
      this.playerList.push(player);

      const RoleClass = this.roleList[index];
      if (!RoleClass) {
        console.error(`No role class found at index ${index} — roleList has ${this.roleList.length} entries`);
        continue;
      }
      const role = new RoleClass(this, player);
      player.assignRole(role);

      io.to(user.socketId).emit(ServerEvent.AssignPlayerRole, {
        name: player.username,
        role: role.name,
        dayVisitSelf: role.dayVisitSelf,
        dayVisitOthers: role.dayVisitOthers,
        dayVisitFaction: role.dayVisitFaction,
        nightVisitSelf: role.nightVisitSelf,
        nightVisitOthers: role.nightVisitOthers,
        nightVisitFaction: role.nightVisitFaction,
        nightVote: role.nightVote,
      });
    }

    this.factionList.push(...roleHandler.assignFactionsFromPlayerList(this.playerList));
    for (const faction of this.factionList) faction.findMembers(this.playerList);
    for (const player of this.playerList) player.role.initRole();

    this.startFirstDaySession(this.sessionLength);
  }

  startFirstDaySession(sessionLength: number) {
    this.time = GamePhase.Day;
    io.to(this.name).emit(ServerEvent.ReceiveMessage, "Day 1 has started.");
    io.to(this.name).emit(ServerEvent.UpdateDayTime, { time: DayTime.Day, dayNumber: 1, timeLeft: 5 });
    setTimeout(() => {
      this.runSafely(() => {
        for (const player of this.playerList) {
          if (player.isAlive) player.role.dayVisit();
        }
        io.to(this.name).emit(ServerEvent.ReceiveMessage, "Night 1 has started.");
      });
      this.startNightSession(1, sessionLength);
    }, 5000);
  }

  startDaySession(dayNumber: number, sessionLength: number) {
    this.time = GamePhase.Day;

    if (this.endDay <= dayNumber) {
      io.to(this.name).emit(ServerEvent.ReceiveMessage, "Nobody has died in three consecutive days, so the game has ended.");
      if (this.peacemaker !== null) {
        this.peacemaker.victoryCondition = true;
        io.to(this.peacemaker.player.user.socketId).emit(ServerEvent.ReceiveMessage, "You have won the game by causing a tie!");
      }
      this.endGame("nobody");
      return;
    } else if (this.endDay - 1 <= dayNumber) {
      io.to(this.name).emit(ServerEvent.ReceiveMessage, "The game will end in a draw if nobody dies today or tonight.");
    }

    io.to(this.name).emit(ServerEvent.UpdateDayTime, {
      time: DayTime.Day,
      dayNumber,
      timeLeft: Math.floor(sessionLength / 1000 + 10),
    });
    io.to(this.name).emit(ServerEvent.ReceiveMessage, `Day ${dayNumber} has started.`);

    const livingPlayerList: Player[] = [];
    for (const player of this.playerList) {
      if (player.isAlive) {
        player.role.dayUpdate();
        player.hasVoted = false;
        player.votesReceived = 0;
        livingPlayerList.push(player);
      }
    }

    const votesRequired = Math.floor(livingPlayerList.length / 2) + 1;
    io.to(this.name).emit(ServerEvent.ReceiveMessage, `It takes ${votesRequired} votes for the town to kill a player.`);

    setTimeout(() => {
      this.runSafely(() => {
        if (!this.confesserVotedOut) {
          for (const livingPlayer of livingPlayerList) {
            if (livingPlayer.votesReceived >= votesRequired) {
              this.endDay = dayNumber + 3;

              if (livingPlayer.role instanceof Confesser) {
                io.to(this.name).emit(
                  ServerEvent.ReceiveMessage,
                  `${livingPlayer.username} was a confesser! Voting has been disabled for the remainder of the game.`,
                );
                this.confesserVotedOut = true;
                livingPlayer.role.victoryCondition = true;
                io.to(this.name).emit(ServerEvent.DisableVoting);
              } else {
                io.to(this.name).emit(ServerEvent.ReceiveMessage, `${livingPlayer.username} has been voted out by the town.`);
              }

              io.to(livingPlayer.user.socketId).emit(ServerEvent.ReceiveMessage, "You have been voted out of the town.");
              io.to(livingPlayer.user.socketId).emit(ServerEvent.BlockMessages);
              livingPlayer.isAlive = false;
              io.to(this.name).emit(ServerEvent.UpdatePlayerRole, { name: livingPlayer.username });

              if (this.framer !== null && this.framer.target === livingPlayer) {
                this.framer.victoryCondition = true;
                io.to(this.framer.player.user.socketId).emit(
                  ServerEvent.ReceiveMessage,
                  "You have successfully gotten your target voted out!",
                );
              }
            }
          }
        }

        io.to(this.name).emit(ServerEvent.ReceiveMessage, `Night ${dayNumber} has started.`);

        for (const player of this.playerList) {
          if (player.isAlive) {
            player.role.dayVisit();
            player.role.dayTapped = false;
            player.hasVoted = false;
          }
        }
      });

      if (dayNumber < 25) {
        const winningFaction = this.findWinningFaction();
        if (winningFaction !== null) {
          this.endGame(winningFaction);
        } else {
          this.startNightSession(dayNumber, sessionLength * 0.85);
        }
      } else {
        this.endGame("nobody");
      }
    }, sessionLength + 10000);
  }

  startNightSession(nightNumber: number, sessionLength: number) {
    this.time = GamePhase.Night;
    io.to(this.name).emit(ServerEvent.UpdateDayTime, { time: DayTime.Night, dayNumber: nightNumber, timeLeft: 15 });

    setTimeout(() => {
      this.runSafely(() => {
        this.time = GamePhase.Processing;

        for (const faction of this.factionList) {
          faction.removeMembers();
          faction.handleNightVote();
        }

        for (const player of this.playerList) {
          if (player.role.roleblocker) player.role.visit();
        }
        for (const player of this.playerList) {
          if (player.role.roleblocked && !player.role.roleblocker) {
            player.role.visiting = null;
            io.to(player.user.socketId).emit(ServerEvent.ReceiveMessage, "You were roleblocked!");
            player.role.roleblocked = false;
          } else if (player.role.visiting != null && !player.role.roleblocker) {
            player.role.visit();
          }
        }
        for (const player of this.playerList) {
          if (player.isAlive) player.role.handleVisits();
        }
        for (const player of this.playerList) {
          if (player.isAlive) {
            if (player.role.handleDamage()) this.endDay = nightNumber + 3;
            player.role.dayVisiting = null;
            player.role.visiting = null;
            player.role.roleblocked = false;
            player.role.visitors = [];
            player.role.nightTapped = false;
          }
        }
      });

      const winningFaction = this.findWinningFaction();
      if (winningFaction !== null) {
        this.endGame(winningFaction);
      } else {
        this.startDaySession(nightNumber + 1, sessionLength);
      }
    }, 15000);
  }

  findWinningFaction(): string | null {
    let lastFaction: string = RoleGroup.Neutral;
    for (const player of this.playerList) {
      if (player.role.group !== RoleGroup.Neutral && player.isAlive) {
        if (lastFaction === RoleGroup.Neutral) {
          lastFaction = player.role.group;
        } else if (player.role.group !== lastFaction) {
          return null;
        }
      }
    }
    return lastFaction;
  }

  endGame(winningFactionName: string) {
    this.gameHasEnded = true;

    const winningRoles = this.playerList
      .filter((player) => {
        if (winningFactionName === "nobody") return false;
        if (winningFactionName === RoleGroup.Neutral) return player.role.group === RoleGroup.Neutral;
        return player.role.group === winningFactionName;
      })
      .map((player) => player.role.name);

    void persistMatchHistory({
      roomName: this.name,
      startedAt: this.startedAt,
      endedAt: new Date(),
      winningFaction: winningFactionName,
      winningRoles,
      participants: this.playerList.map((player) => ({
        username: player.username,
        role: player.role.name,
        won:
          winningFactionName === "nobody"
            ? false
            : winningFactionName === RoleGroup.Neutral
              ? player.role.group === RoleGroup.Neutral
              : player.role.group === winningFactionName,
      })),
      conversationHistory: this.conversationHistory,
      actionHistory: this.actionHistory,
    }).catch((error) => {
      console.error("Failed to persist match history", error);
    });

    if (winningFactionName === "nobody") {
      io.to(this.name).emit(ServerEvent.ReceiveMessage, "The game has ended with a draw!");
    } else if (winningFactionName === RoleGroup.Neutral) {
      io.to(this.name).emit(ServerEvent.ReceiveMessage, "The neutral players have won!");
    } else {
      const suffix = winningFactionName.endsWith("s") ? "have" : "has";
      io.to(this.name).emit(ServerEvent.ReceiveMessage, `The ${winningFactionName} ${suffix} won!`);
    }
    io.to(this.name).emit(ServerEvent.ReceiveMessage, "Closing the room!");
    io.to(this.name).emit(ServerEvent.BlockMessages);
    io.in(this.name).disconnectSockets();
  }
}
