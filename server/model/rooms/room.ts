import Crypto from "crypto";
import { RoleHandler } from "./initRoles/roleHandler.js";
import { User } from "../user/user.js";
import { Player } from "../player/player.js";
import type { GamePlayerSocket } from "@mernmafia/shared/communication/serverTypes";
import { ServerEvent } from "@mernmafia/shared/communication/events";
import { DayTime } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../servers/emitter.js";
import { Confesser } from "../roles/neutral/confesser.js";
import { Faction } from "../factions/abstractFaction.js";
import { BlankRole } from "../roles/blankRole.js";
import { Role } from "../roles/abstractRole.js";
import { Framer } from "../roles/neutral/framer.js";
import { Peacemaker } from "../roles/neutral/peacemaker.js";
import { RoleGroup } from "../roles/roleGroup.js";
import { CombatLevel } from "../roles/combatLevel.js";
import { GamePhase } from "./gamePhase.js";
import { names } from "../player/names/namesList.js";
import { fromThrowable } from "neverthrow";
import {
  persistMatchHistory,
  rotateActiveRoom,
  type MatchHistoryEvent,
} from "../../data/matchHistory.js";

const DEFAULT_END_DAY_COUNT = 3;
const SESSION_LENGTH_PER_PLAYER_MS = 4000;
const DAY_START_TIME_LEFT_SECONDS = 5;
const DAY_START_DELAY_MS = 5000;
const NIGHT_START_DELAY_MS = 15000;
const NIGHT_TIME_LEFT_SECONDS = 15;
const DAY_END_EXTRA_SECONDS = 10;
const MAX_GAME_DAYS = 25;
const DRAW_TRIGGER_DAYS = 3;
const WHISPER_OVERHEARD_PROBABILITY = 0.1;
const VOTE_QUORUM_OFFSET = 1;
const GENERIC_JOIN_ERROR_CODE = 1;
const ROOM_FULL_ERROR_CODE = 3;

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
  endDay = DEFAULT_END_DAY_COUNT;

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
    this.sessionLength = this.size * SESSION_LENGTH_PER_PLAYER_MS;
  }

  private recordConversation(
    content: string,
    actor?: string,
    target?: string,
    type: MatchHistoryEvent["type"] = "chat",
  ) {
    this.conversationHistory.push({
      time: Date.now(),
      type,
      actor,
      target,
      content,
    });
  }

  private recordAction(content: string, actor?: string, target?: string) {
    this.actionHistory.push({
      time: Date.now(),
      type: "action",
      actor,
      target,
      content,
    });
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

  private isActionInWrongPhase(isDay: boolean) {
    return (
      (!isDay && this.time === GamePhase.Day) ||
      (isDay && this.time === GamePhase.Night) ||
      this.time === GamePhase.Idle
    );
  }

  /**
   * Adds a connected client to the lobby.
   * Returns an error code on failure or the assigned username on success.
   */
  addUser(playerSocket: GamePlayerSocket): string | number {
    const socketId = playerSocket.id;
    if (this.userList.some((u) => u.socketId === socketId))
      return GENERIC_JOIN_ERROR_CODE;
    if (this.userList.length >= this.size) return ROOM_FULL_ERROR_CODE;

    const takenNames = this.userList.map((u) => u.username);
    const username = names.find((n) => !takenNames.includes(n));
    if (!username) return GENERIC_JOIN_ERROR_CODE;

    const user = new User(playerSocket, username);
    const position = this.userList.push(user) - 1;
    playerSocket.data.position = position;

    this.emitUserList(socketId);
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.PlayerJoinedRoom,
      params: { playerName: username },
    });
    this.recordConversation(`${username} has joined the room!`, username);
    io.to(this.name).emit(ServerEvent.ReceiveNewPlayer, { name: username });

    if (this.userList.length === this.size) {
      this.started = true;
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.RoomFullStartingGame,
      });
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
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.PlayerLeftRoom,
        params: { playerName: user.username },
      });
      this.recordConversation(
        `${user.username} has left the room!`,
        user.username,
      );
      this.userList.splice(index, 1);
      for (const [i, u] of this.userList.entries()) {
        u.socket.data.position = i;
      }
    } else {
      const player = this.playerList.find((p) => p.user.socketId === socketId);
      if (!player) return;
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.PlayerAbandonedGame,
        params: { playerName: player.username },
      });
      player.role.damage = CombatLevel.Fatal;
    }
  }

  emitUserList(target: string) {
    const list = this.userList.map((u) => {
      const player = this.playerList.find((p) => p.user === u);
      return {
        name: u.username,
        isAlive: this.started ? (player?.isAlive ?? false) : undefined,
        role:
          this.started && player && !player.isAlive
            ? player.role.name
            : undefined,
      };
    });
    io.to(target).emit(ServerEvent.ReceivePlayerList, list);
  }

  handleSentMessage(
    playerSocket: GamePlayerSocket,
    message: string,
    isDay: boolean,
  ) {
    const handle = fromThrowable(
      () => {
        if (
          (!isDay && this.time === GamePhase.Day) ||
          (isDay && this.time === GamePhase.Night) ||
          playerSocket.data.position === undefined
        )
          return;

        if (this.started) {
          const player = this.getPlayerFromSocket(playerSocket);
          if (!player) return;
          if (player.isAlive) {
            player.role.handleMessage(message);
          } else {
            io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
              key: MessageKey.CannotSpeakYouAreDead,
            });
          }
          this.recordConversation(message, player.username);
        } else {
          const user = this.userList[playerSocket.data.position];
          if (!user) return;
          io.to(this.name).emit(
            ServerEvent.ReceiveChatMessage,
            `${user.username}: ${message}`,
          );
          this.recordConversation(message, user.username);
        }
      },
      (error) => error,
    );

    const result = handle();
    if (result.isErr()) {
      io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotSpeakDeadOrError,
      });
      console.error(result.error);
    }
  }

  handleVote(
    playerSocket: GamePlayerSocket,
    recipient: number,
    isDay: boolean,
  ) {
    this.runSafely(() => {
      if (this.isActionInWrongPhase(isDay)) return;
      if (playerSocket.data.position === undefined) return;

      const foundPlayer = this.getPlayerFromSocket(playerSocket);
      const foundRecipient = this.playerList[recipient];
      if (!foundPlayer || !foundRecipient) return;

      if (foundPlayer.hasVoted) {
        io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.CannotChangeVote,
        });
        return;
      }

      if (foundPlayer === foundRecipient) {
        io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.CannotVoteForYourself,
        });
        return;
      }

      if (this.time !== GamePhase.Day) {
        if (!foundPlayer.role.nightVote) {
          io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
            key: MessageKey.CannotVoteAtNight,
          });
          return;
        }
        foundPlayer.hasVoted = true;
        foundPlayer.role.handleNightVote(foundRecipient);
        return;
      }

      if (this.confesserVotedOut) {
        io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.VotingDisabledConfeser,
        });
        return;
      }

      if (!foundRecipient.isAlive) {
        io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.VoteInvalid,
        });
        return;
      }

      this.recordAction("vote", foundPlayer.username, foundRecipient.username);
      foundPlayer.hasVoted = true;
      foundRecipient.votesReceived++;
      const voteMsg =
        foundRecipient.votesReceived > 1
          ? {
              key: MessageKey.VoteCastMultipleVotes,
              params: {
                voterName: foundPlayer.username,
                targetName: foundRecipient.username,
                count: foundRecipient.votesReceived,
              },
            }
          : {
              key: MessageKey.VoteCastSingleVote,
              params: {
                voterName: foundPlayer.username,
                targetName: foundRecipient.username,
              },
            };
      io.to(this.name).emit(ServerEvent.ReceiveMessage, voteMsg);
    });
  }

  handleWhisper(
    playerSocket: GamePlayerSocket,
    recipient: number,
    message: string,
    isDay: boolean,
  ) {
    this.runSafely(() => {
      if (this.isActionInWrongPhase(isDay)) return;
      if (playerSocket.data.position === undefined) return;

      const foundPlayer = this.getPlayerFromSocket(playerSocket);
      const foundRecipient = this.playerList[recipient];
      if (!foundPlayer || !foundRecipient) return;

      if (this.time === GamePhase.Night) {
        io.to(foundPlayer.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.CannotWhisperAtNight,
        });
        return;
      }

      if (!foundRecipient.isAlive) {
        io.to(foundPlayer.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.InvalidWhisperRecipient,
        });
        return;
      }

      this.recordAction(
        "whisper",
        foundPlayer.username,
        foundRecipient.username,
      );
      if (WHISPER_OVERHEARD_PROBABILITY > Math.random()) {
        io.to(foundPlayer.user.socketId).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.WhispersOverheardBySender,
        });
        io.to(this.name).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.WhisperOverheardBroadcast,
          params: {
            senderName: foundPlayer.username,
            message,
            recipientName: foundRecipient.username,
          },
        });
        return;
      }

      io.to(foundRecipient.user.socketId).emit(
        ServerEvent.ReceiveWhisperMessage,
        `Whisper from ${foundPlayer.username}: ${message}`,
      );
      this.recordConversation(
        message,
        foundPlayer.username,
        foundRecipient.username,
        "whisper",
      );
      io.to(foundPlayer.user.socketId).emit(
        ServerEvent.ReceiveWhisperMessage,
        `Whisper to ${foundRecipient.username}: ${message}`,
      );

      const tappedMessage = `${foundPlayer.username} whispered "${message}" to ${foundRecipient.username}.`;
      const senderTap = foundPlayer.role.dayTapped;
      if (senderTap instanceof Role) {
        io.to(senderTap.player.user.socketId).emit(
          ServerEvent.ReceiveWhisperMessage,
          tappedMessage,
        );
      }
      const recipientTap = foundRecipient.role.dayTapped;
      if (recipientTap instanceof Role) {
        io.to(recipientTap.player.user.socketId).emit(
          ServerEvent.ReceiveWhisperMessage,
          tappedMessage,
        );
      }
    });
  }

  handleVisit(
    playerSocket: GamePlayerSocket,
    recipient: number | null,
    isDay: boolean,
  ) {
    this.runSafely(() => {
      if (this.isActionInWrongPhase(isDay)) return;
      if (playerSocket.data.position === undefined) return;

      const foundPlayer = this.getPlayerFromSocket(playerSocket);
      const foundRecipient =
        recipient !== null ? this.playerList[recipient] : null;
      if (!foundPlayer) return;

      if (this.time === GamePhase.Day) {
        if (foundRecipient == null) {
          foundPlayer.role.cancelDayAction();
          return;
        }
        this.recordAction(
          "day-visit",
          foundPlayer.username,
          foundRecipient.username,
        );
        foundPlayer.role.handleDayAction(foundRecipient);
        return;
      }

      if (this.time === GamePhase.Night) {
        if (foundPlayer.role.roleblocked) {
          io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
            key: MessageKey.RoleblockedCannotCommand,
          });
          return;
        }
        if (foundRecipient == null) {
          foundPlayer.role.cancelNightAction();
          return;
        }
        this.recordAction(
          "night-visit",
          foundPlayer.username,
          foundRecipient.username,
        );
        foundPlayer.role.handleNightAction(foundRecipient);
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

      const RoleClassOrDef = this.roleList[index];
      if (!RoleClassOrDef) {
        console.error(
          `No role class found at index ${index} — roleList has ${this.roleList.length} entries`,
        );
        continue;
      }

      // Use roleHandler to instantiate (handles both classes and custom definitions)
      const role = roleHandler.instantiateRole(RoleClassOrDef, this, player);
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

    this.factionList.push(
      ...roleHandler.assignFactionsFromPlayerList(this.playerList),
    );
    for (const faction of this.factionList)
      faction.findMembers(this.playerList);
    for (const player of this.playerList) player.role.initRole();

    this.startFirstDaySession(this.sessionLength);
  }

  startFirstDaySession(sessionLength: number) {
    this.time = GamePhase.Day;
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.Day1Started,
    });
    io.to(this.name).emit(ServerEvent.UpdateDayTime, {
      time: DayTime.Day,
      dayNumber: 1,
      timeLeft: DAY_START_TIME_LEFT_SECONDS,
    });
    setTimeout(() => {
      this.runSafely(() => {
        for (const player of this.playerList) {
          if (player.isAlive) player.role.dayVisit();
        }
        io.to(this.name).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.Night1Started,
        });
      });
      this.startNightSession(1, sessionLength);
    }, DAY_START_DELAY_MS);
  }

  startDaySession(dayNumber: number, sessionLength: number) {
    this.time = GamePhase.Day;

    if (this.endDay <= dayNumber) {
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.GameEndedNobodyDied,
      });
      if (this.peacemaker !== null) {
        this.peacemaker.victoryCondition = true;
        io.to(this.peacemaker.player.user.socketId).emit(
          ServerEvent.ReceiveMessage,
          { key: MessageKey.PeacemakerWon },
        );
      }
      this.endGame("nobody");
      return;
    } else if (this.endDay - 1 <= dayNumber) {
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.DrawWarnOneDay,
      });
    }

    io.to(this.name).emit(ServerEvent.UpdateDayTime, {
      time: DayTime.Day,
      dayNumber,
      timeLeft: Math.floor(sessionLength / 1000 + DAY_END_EXTRA_SECONDS),
    });
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.DayNStarted,
      params: { dayNumber },
    });

    const livingPlayerList: Player[] = [];
    for (const player of this.playerList) {
      if (player.isAlive) {
        player.role.dayUpdate();
        player.hasVoted = false;
        player.votesReceived = 0;
        livingPlayerList.push(player);
      }
    }

    const votesRequired =
      Math.floor(livingPlayerList.length / 2) + VOTE_QUORUM_OFFSET;
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.VotesRequired,
      params: { count: votesRequired },
    });

    setTimeout(
      () => {
        this.runSafely(() => {
          if (!this.confesserVotedOut) {
            for (const livingPlayer of livingPlayerList) {
              if (livingPlayer.votesReceived >= votesRequired) {
                this.endDay = dayNumber + DRAW_TRIGGER_DAYS;

                if (livingPlayer.role instanceof Confesser) {
                  io.to(this.name).emit(ServerEvent.ReceiveMessage, {
                    key: MessageKey.ConfeserVotedOut,
                    params: { playerName: livingPlayer.username },
                  });
                  this.confesserVotedOut = true;
                  livingPlayer.role.victoryCondition = true;
                  io.to(this.name).emit(ServerEvent.DisableVoting);
                } else {
                  io.to(this.name).emit(ServerEvent.ReceiveMessage, {
                    key: MessageKey.PlayerVotedOutByTown,
                    params: { playerName: livingPlayer.username },
                  });
                }

                io.to(livingPlayer.user.socketId).emit(
                  ServerEvent.ReceiveMessage,
                  { key: MessageKey.YouHaveBeenVotedOut },
                );
                io.to(livingPlayer.user.socketId).emit(
                  ServerEvent.BlockMessages,
                );
                livingPlayer.isAlive = false;
                io.to(this.name).emit(ServerEvent.UpdatePlayerRole, {
                  name: livingPlayer.username,
                });

                if (
                  this.framer !== null &&
                  this.framer.target === livingPlayer
                ) {
                  this.framer.victoryCondition = true;
                  io.to(this.framer.player.user.socketId).emit(
                    ServerEvent.ReceiveMessage,
                    { key: MessageKey.FramerTargetVotedOut },
                  );
                }
              }
            }
          }

          io.to(this.name).emit(ServerEvent.ReceiveMessage, {
            key: MessageKey.NightNStarted,
            params: { dayNumber },
          });

          for (const player of this.playerList) {
            if (player.isAlive) {
              player.role.dayVisit();
              player.role.dayTapped = false;
              player.hasVoted = false;
            }
          }
        });

        if (dayNumber < MAX_GAME_DAYS) {
          const winningFaction = this.findWinningFaction();
          if (winningFaction !== null) {
            this.endGame(winningFaction);
          } else {
            this.startNightSession(dayNumber, sessionLength * 0.85);
          }
        } else {
          this.endGame("nobody");
        }
      },
      sessionLength + DAY_END_EXTRA_SECONDS * 1000,
    );
  }

  startNightSession(nightNumber: number, sessionLength: number) {
    this.time = GamePhase.Night;
    io.to(this.name).emit(ServerEvent.UpdateDayTime, {
      time: DayTime.Night,
      dayNumber: nightNumber,
      timeLeft: NIGHT_TIME_LEFT_SECONDS,
    });

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
            io.to(player.user.socketId).emit(ServerEvent.ReceiveMessage, {
              key: MessageKey.YouWereRoleblocked,
            });
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
            if (player.role.handleDamage())
              this.endDay = nightNumber + DRAW_TRIGGER_DAYS;
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
    }, NIGHT_START_DELAY_MS);
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
        if (winningFactionName === RoleGroup.Neutral)
          return player.role.group === RoleGroup.Neutral;
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
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.GameEndedDraw,
      });
    } else if (winningFactionName === RoleGroup.Neutral) {
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.NeutralPlayersWon,
      });
    } else {
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.FactionWon,
        params: { factionName: winningFactionName },
      });
    }
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.ClosingRoom,
    });
    io.to(this.name).emit(ServerEvent.BlockMessages);
    io.in(this.name).disconnectSockets();
  }
}
