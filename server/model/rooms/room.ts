import Crypto from "crypto";
import { RoleHandler } from "./initRoles/roleHandler.js";
import { Player } from "../player/player.js";
import { type Confesser } from "../roles/neutral/confesser.js";
import { type Faction } from "../factions/abstractFaction.js";
import { type BlankRole } from "../roles/blankRole.js";
import { type Framer } from "../roles/neutral/framer.js";
import { type Peacemaker } from "../roles/neutral/peacemaker.js";
import { names } from "../player/names/namesList.js";
import type { SocketHandler } from "../socketHandler/socketHandler.js";
import { Time } from "../../../shared/socketTypes/socketTypes.js";
import {
  SESSION_LENGTH_MULTIPLIER,
  WHISPER_OVERHEARD_CHANCE,
  MAX_GAME_DAYS,
  DEATH_EXTENSION_DAYS,
  ABANDON_DAMAGE,
} from "../../constants/gameConstants.js";

// Import new managers
import { GameStateManager } from "../managers/GameStateManager.js";
import {
  PhaseManager,
  FirstDayPhaseStrategy,
  DayPhaseStrategy,
  NightPhaseStrategy,
  type PhaseContext,
} from "../managers/PhaseManager.js";
import {
  WinConditionManager,
  PeacemakerWinCondition,
  MaxDaysWinCondition,
  FactionEliminationWinCondition,
  type WinConditionContext,
} from "../managers/WinConditionManager.js";
import { EventBus, GameEventType } from "../managers/EventBus.js";
import { PlayerRegistry } from "../managers/PlayerRegistry.js";

/**
 * Room class manages a game session of MERN-Mafia
 */
export class Room {
  /** Unique room identifier generated using crypto */
  name: string;
  /** Maximum number of players allowed in the room */
  size: number;

  /** Array of role classes available for this game */
  roleList: (typeof BlankRole)[] = [];
  /** Array of faction instances for coordinated roles */
  factionList: Faction[] = [];
  /** Base duration for day/night sessions in milliseconds */
  sessionLength: number;

  /** Special role references for game mechanics */
  framer: Framer | null = null;
  peacemaker: Peacemaker | null = null;
  confesser?: Confesser;

  /** Socket handler for communication with clients */
  socketHandler: SocketHandler;

  // Managers (new architecture)
  private stateManager: GameStateManager;
  private playerRegistry: PlayerRegistry;
  private phaseManager: PhaseManager;
  private winConditionManager: WinConditionManager;
  private eventBus: EventBus;

  /**
   * Creates a new game room
   * @param size Maximum number of players allowed
   * @param socketHandler Handler for client communication
   */
  constructor(size: number, socketHandler: SocketHandler) {
    // Data relating to the players in the room
    this.name = Crypto.randomBytes(8).toString("hex");
    this.size = size;
    this.socketHandler = socketHandler;
    this.sessionLength = this.size * SESSION_LENGTH_MULTIPLIER;

    // Initialize managers
    this.stateManager = new GameStateManager();
    this.playerRegistry = new PlayerRegistry();
    this.phaseManager = new PhaseManager();
    this.winConditionManager = new WinConditionManager();
    this.eventBus = new EventBus();

    // Register win conditions
    this.winConditionManager.registerCondition(new PeacemakerWinCondition());
    this.winConditionManager.registerCondition(
      new MaxDaysWinCondition(MAX_GAME_DAYS),
    );
    this.winConditionManager.registerCondition(
      new FactionEliminationWinCondition(),
    );

    // Set initial end day
    this.stateManager.setEndDay(DEATH_EXTENSION_DAYS);
  }

  // Getter methods for backward compatibility
  get playerList(): Player[] {
    return [...this.playerRegistry.getAllPlayers()];
  }

  get playerCount(): number {
    return this.playerRegistry.getPlayerCount();
  }

  get started(): boolean {
    return this.stateManager.hasStarted();
  }

  set started(value: boolean) {
    this.stateManager.setStarted(value);
  }

  get time(): Time {
    return this.stateManager.getCurrentPhase();
  }

  set time(value: Time) {
    this.stateManager.setCurrentPhase(value);
  }

  get gameHasEnded(): boolean {
    return this.stateManager.hasEnded();
  }

  set gameHasEnded(value: boolean) {
    this.stateManager.setGameEnded(value);
  }

  get endDay(): number {
    return this.stateManager.getEndDay();
  }

  set endDay(value: number) {
    this.stateManager.setEndDay(value);
  }

  get confesserVotedOut(): boolean {
    return this.stateManager.isConjesserVotedOut();
  }

  set confesserVotedOut(value: boolean) {
    this.stateManager.setConjesserVotedOut(value);
  }

  /**
   * Adds a new player to the room and starts the game when full
   * @param socketId Unique socket identifier for the player
   * @returns Error code (1=duplicate socket, 3=room full) or player username on success
   */
  addPlayer(socketId: string) {
    // Check for duplicate socket ID
    if (this.playerRegistry.hasSocketId(socketId)) {
      return 1;
    }

    // Check if room is full
    if (this.playerRegistry.getPlayerCount() >= this.size) {
      return 3;
    }

    // Generate username
    let playerUsername = "";
    const takenNames = this.playerRegistry.getTakenUsernames();
    for (const name of names) {
      if (!takenNames.includes(name)) {
        playerUsername = name;
        break;
      }
    }

    this.emitPlayerList(socketId);

    this.socketHandler.sendRoomMessage(this.name, {
      name: "receiveMessage",
      data: { message: `${playerUsername} has joined the room!` },
    });

    const newPos = this.playerRegistry.getPlayerCount();
    const newPlayer = new Player(socketId, playerUsername, newPos);
    this.playerRegistry.addPlayer(newPlayer);

    this.socketHandler.sendRoomMessage(this.name, {
      name: "receive-new-player",
      data: { player: { name: playerUsername } },
    });

    // Publish player joined event
    this.eventBus.publish({
      type: GameEventType.PLAYER_JOINED,
      timestamp: Date.now(),
      data: { playerUsername, socketId },
    });

    // Start the game if room is full
    if (this.playerRegistry.getPlayerCount() === this.size) {
      this.stateManager.setStarted(true);
      console.debug("Room full, starting game", {
        roomName: this.name,
        playerCount: this.playerRegistry.getPlayerCount(),
        playerSockets: this.playerRegistry
          .getAllPlayers()
          .map((p) => p.socketId),
      });
      this.socketHandler.sendRoomMessage(this.name, {
        name: "receiveMessage",
        data: { message: "The room is full! Starting the game!" },
      });
      this.emitPlayerList(this.name);
      this.startGame();
    }
    return playerUsername;
  }

  //Handles a player being removed if they've disconnected
  removePlayer(playerSocketId: string) {
    const player = this.playerRegistry.findBySocketId(playerSocketId);

    if (!player || this.stateManager.hasEnded()) {
      return;
    }

    if (!this.stateManager.hasStarted()) {
      // Remove player if game hasn't started
      this.socketHandler.sendRoomMessage(this.name, {
        name: "remove-player",
        data: { player: { name: player.playerUsername } },
      });
      this.socketHandler.sendRoomMessage(this.name, {
        name: "receiveMessage",
        data: { message: `${player.playerUsername} has left the room!` },
      });
      this.playerRegistry.removePlayer(player);

      this.eventBus.publish({
        type: GameEventType.PLAYER_LEFT,
        timestamp: Date.now(),
        data: {
          playerUsername: player.playerUsername,
          socketId: playerSocketId,
        },
      });
    } else {
      // Kill player if game has started
      this.socketHandler.sendRoomMessage(this.name, {
        name: "receiveMessage",
        data: {
          message: `${player.playerUsername} has abandoned the game!`,
        },
      });
      player.role.damage = ABANDON_DAMAGE;
    }
  }

  isInRoom(playerSocketId: string) {
    return this.playerRegistry.hasSocketId(playerSocketId);
  }

  emitPlayerList(socketId: string) {
    //Returns a player list
    const playersReturned: {
      name: string;
      isAlive?: boolean;
      role?: string;
    }[] = [];

    for (const player of this.playerRegistry.getAllPlayers()) {
      playersReturned.push({
        name: player.playerUsername,
        isAlive: this.stateManager.hasStarted() ? player.isAlive : undefined,
        role:
          this.stateManager.hasStarted() && !player.isAlive
            ? player.role.name
            : undefined,
      });
    }

    if (socketId === this.name) {
      this.socketHandler.sendRoomMessage(this.name, {
        name: "receive-player-list",
        data: { playerList: playersReturned },
      });
    } else {
      this.socketHandler.sendPlayerMessage(socketId, {
        name: "receive-player-list",
        data: { playerList: playersReturned },
      });
    }
  }

  //Handles users sending messages to the chat
  handleSentMessage(socketId: string, message: string, isDay: boolean) {
    try {
      const foundPlayer = this.playerRegistry.findBySocketId(socketId);
      if (!foundPlayer) {
        this.socketHandler.sendPlayerMessage(socketId, {
          name: "receiveMessage",
          data: { message: "Player object could not be found." },
        });
        return;
      }

      if (
        (!isDay && this.time === Time.Day) ||
        (isDay && this.time === Time.Night)
      )
        return;

      if (this.stateManager.hasStarted()) {
        // If the game has started, handle the message with the role object
        if (foundPlayer.isAlive) {
          foundPlayer.role.handleMessage(message);
          this.eventBus.publish({
            type: GameEventType.MESSAGE_SENT,
            timestamp: Date.now(),
            data: { playerId: socketId, message, phase: this.time },
          });
        } else {
          this.socketHandler.sendPlayerMessage(socketId, {
            name: "receiveMessage",
            data: { message: "You cannot speak, as you are dead." },
          });
        }
      } else {
        this.socketHandler.sendRoomMessage(this.name, {
          name: "receive-chat-message",
          data: { message: `${foundPlayer.playerUsername}: ${message}` },
        });
      }
    } catch (error) {
      this.socketHandler.sendPlayerMessage(socketId, {
        name: "receiveMessage",
        data: {
          message: "You cannot speak, as you are dead. Or an error occured.",
        },
      });
      console.log(error);
    }
  }

  handleVote(playerSocketId: string, recipient: number, isDay: boolean) {
    try {
      const foundPlayer = this.playerRegistry.findBySocketId(playerSocketId);
      const foundRecipient = this.playerRegistry.findByPosition(recipient);

      if (!foundPlayer || !foundRecipient) {
        this.socketHandler.sendPlayerMessage(playerSocketId, {
          name: "receiveMessage",
          data: { message: "Player object could not be found." },
        });
        return;
      }

      if (
        (!isDay && this.time === Time.Day) ||
        (isDay && this.time === Time.Night) ||
        this.time === Time.Between
      )
        return;

      if (foundPlayer.hasVoted) {
        this.socketHandler.sendPlayerMessage(playerSocketId, {
          name: "receiveMessage",
          data: { message: "You cannot change your vote." },
        });
      } else if (foundPlayer === foundRecipient) {
        this.socketHandler.sendPlayerMessage(playerSocketId, {
          name: "receiveMessage",
          data: { message: "You cannot vote for yourself." },
        });
      } else if (this.time !== Time.Day) {
        if (foundPlayer.role.nightVote) {
          foundPlayer.hasVoted = true;
          foundPlayer.role.handleNightVote(foundRecipient);
        } else {
          this.socketHandler.sendPlayerMessage(playerSocketId, {
            name: "receiveMessage",
            data: { message: "You cannot vote at night." },
          });
        }
      } else if (this.confesserVotedOut) {
        this.socketHandler.sendPlayerMessage(playerSocketId, {
          name: "receiveMessage",
          data: {
            message: "The town voted out a confessor, disabling voting.",
          },
        });
      } else if (foundRecipient.isAlive && !foundPlayer.hasVoted) {
        foundPlayer.hasVoted = true;
        foundRecipient.votesReceived++;

        this.eventBus.publish({
          type: GameEventType.VOTE_CAST,
          timestamp: Date.now(),
          data: {
            voterId: playerSocketId,
            targetId: foundRecipient.socketId,
            votesReceived: foundRecipient.votesReceived,
          },
        });

        if (foundRecipient.votesReceived > 1)
          this.socketHandler.sendRoomMessage(this.name, {
            name: "receiveMessage",
            data: {
              message:
                `${foundPlayer.playerUsername} has voted for ${foundRecipient.playerUsername} to be executed! There are ${String(foundRecipient.votesReceived)} votes for ${foundRecipient.playerUsername} to be killed.`,
            },
          });
        else
          this.socketHandler.sendRoomMessage(this.name, {
            name: "receiveMessage",
            data: {
              message:
                `${foundPlayer.playerUsername} has voted for ${foundRecipient.playerUsername} to be executed! There is 1 vote for ${foundRecipient.playerUsername} to be killed.`,
            },
          });
      } else {
        this.socketHandler.sendPlayerMessage(playerSocketId, {
          name: "receiveMessage",
          data: { message: "Your vote was invalid." },
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  handleWhisper(
    playerSocketId: string,
    recipient: number,
    message: string,
    isDay: boolean,
  ) {
    try {
      const foundPlayer = this.playerRegistry.findBySocketId(playerSocketId);
      const foundRecipient = this.playerRegistry.findByPosition(recipient);

      if (!foundPlayer || !foundRecipient) {
        console.error("Invalid whisper!");
        return;
      }

      if (
        (!isDay && this.time === Time.Day) ||
        (isDay && this.time == Time.Night) ||
        this.time === Time.Between
      )
        return;

      if (this.time === Time.Night) {
        this.socketHandler.sendPlayerMessage(foundPlayer.socketId, {
          name: "receiveMessage",
          data: { message: "You cannot whisper at night." },
        });
      } else if (this.time === Time.Day && foundRecipient.isAlive) {
        if (WHISPER_OVERHEARD_CHANCE > Math.random()) {
          // Whisper was overheard by the town
          this.socketHandler.sendPlayerMessage(foundPlayer.socketId, {
            name: "receiveMessage",
            data: { message: "Your whispers were overheard by the town!" },
          });
          this.socketHandler.sendRoomMessage(this.name, {
            name: "receiveMessage",
            data: {
              message:
                `${foundPlayer.playerUsername} tried to whisper "${message}" to ${foundRecipient.playerUsername}, but was overheard by the town!`,
            },
          });
        } else {
          this.socketHandler.sendPlayerMessage(foundRecipient.socketId, {
            name: "receive-whisper-message",
            data: {
              message:
                `Whisper from ${foundPlayer.playerUsername}: ${message}`,
            },
          });
          this.socketHandler.sendPlayerMessage(foundPlayer.socketId, {
            name: "receive-whisper-message",
            data: {
              message:
                `Whisper to ${foundRecipient.playerUsername}: ${message}`,
            },
          });

          this.eventBus.publish({
            type: GameEventType.WHISPER_SENT,
            timestamp: Date.now(),
            data: {
              from: foundPlayer.socketId,
              to: foundRecipient.socketId,
              overheard: false,
            },
          });

          if (
            foundPlayer.role.dayTapped !== false &&
            typeof foundPlayer.role.dayTapped !== "boolean"
          )
            this.socketHandler.sendPlayerMessage(
              foundPlayer.role.dayTapped.player.socketId,
              {
                name: "receive-whisper-message",
                data: {
                  message:
                    `${foundPlayer.playerUsername} whispered "${message}" to ${foundRecipient.playerUsername}.`,
                },
              },
            );
          else if (
            foundRecipient.role.dayTapped !== false &&
            typeof foundRecipient.role.dayTapped !== "boolean"
          )
            this.socketHandler.sendPlayerMessage(
              foundRecipient.role.dayTapped.player.socketId,
              {
                name: "receive-whisper-message",
                data: {
                  message:
                    `${foundPlayer.playerUsername} whispered "${message}" to ${foundRecipient.playerUsername}.`,
                },
              },
            );
        }
      } else {
        this.socketHandler.sendPlayerMessage(foundPlayer.socketId, {
          name: "receiveMessage",
          data: {
            message:
              "You didn't whisper to a valid recipient, or they are dead.",
          },
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  handleVisit(
    playerSocketId: string,
    recipient: number | null,
    isDay: boolean,
  ) {
    try {
      const foundPlayer = this.playerRegistry.findBySocketId(playerSocketId);
      const foundRecipient =
        recipient !== null
          ? this.playerRegistry.findByPosition(recipient)
          : null;

      if (!foundPlayer) {
        console.error("Invalid visit!");
        return;
      }

      if (
        (!isDay && this.time === Time.Day) ||
        (isDay && this.time === Time.Night) ||
        this.time === Time.Between
      )
        return;

      if (this.time === Time.Day) {
        if (foundRecipient !== null)
          foundPlayer.role.handleDayAction(foundRecipient);
        else foundPlayer.role.cancelDayAction();
      } else if (this.time === Time.Night) {
        if (foundPlayer.role.roleblocked)
          this.socketHandler.sendPlayerMessage(playerSocketId, {
            name: "receiveMessage",
            data: { message: "You are roleblocked, and cannot call commands." },
          });
        else {
          if (foundRecipient !== null)
            foundPlayer.role.handleNightAction(foundRecipient);
          else foundPlayer.role.cancelNightAction();
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  startGame() {
    console.debug("startGame invoked", {
      roomName: this.name,
      playerCount: this.playerRegistry.getPlayerCount(),
    });

    const roleHandler = new RoleHandler(this.playerRegistry.getPlayerCount());
    this.roleList.push(...roleHandler.assignGame());

    // Shuffle the list of roles
    let currentIndex = this.roleList.length;
    let randomIndex;
    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      const randomInst = this.roleList[randomIndex];
      const currentInst = this.roleList[currentIndex];

      if (randomInst && currentInst) {
        [this.roleList[currentIndex], this.roleList[randomIndex]] = [
          randomInst,
          currentInst,
        ];
      }
    }

    // Allocate shuffled roles to players
    let i = 0;
    for (const player of this.playerRegistry.getAllPlayers()) {
      player.position = i;
      const role = this.roleList[i];
      if (role === undefined) {
        console.error("Invalid role instance!");
        continue;
      }
      player.role = new role(this, player);

      const playerReturned = {
        name: player.playerUsername,
        role: player.role.name,
        dayVisitSelf: player.role.dayVisitSelf,
        dayVisitOthers: player.role.dayVisitOthers,
        dayVisitFaction: player.role.dayVisitFaction,
        nightVisitSelf: player.role.nightVisitSelf,
        nightVisitOthers: player.role.nightVisitOthers,
        nightVisitFaction: player.role.nightVisitFaction,
        nightVote: player.role.nightVote,
      };
      this.socketHandler.sendPlayerMessage(player.socketId, {
        name: "assign-player-role",
        data: playerReturned,
      });
      i++;
    }

    this.factionList.push(
      ...roleHandler.assignFactionsFromPlayerList([
        ...this.playerRegistry.getAllPlayers(),
      ]),
    );

    // Assign roles to each faction, then factions to each relevant role
    for (const faction of this.factionList) {
      faction.findMembers([...this.playerRegistry.getAllPlayers()]);
    }

    // Initialize roles once for all players
    for (const player of this.playerRegistry.getAllPlayers()) {
      player.role.initRole();
    }

    // Publish game started event
    this.eventBus.publish({
      type: GameEventType.GAME_STARTED,
      timestamp: Date.now(),
      data: {
        roomName: this.name,
        playerCount: this.playerRegistry.getPlayerCount(),
      },
    });

    // Start the first day session
    this.startFirstDaySession(this.sessionLength);
  }

  //Sessions - Each session lasts for a period of time.
  //After it is over, the room executes the actions decided by the players.
  //Then, it checks the living player's factions to determine if the game is over.

  /**
   * Starts the first day session with shortened duration
   * @param sessionLength Base session length in milliseconds
   */
  startFirstDaySession(sessionLength: number) {
    this.stateManager.setCurrentPhase(Time.Day);
    this.stateManager.setDayNumber(1);

    const context = this.createPhaseContext(1, sessionLength);
    const strategy = new FirstDayPhaseStrategy();
    this.phaseManager.startPhase(strategy, context);
  }

  /**
   * Starts a day session where players can discuss, vote, and use day abilities
   * @param dayNumber Current day number
   * @param sessionLength Duration of the day session in milliseconds
   */
  startDaySession(dayNumber: number, sessionLength: number) {
    this.stateManager.setCurrentPhase(Time.Day);
    this.stateManager.setDayNumber(dayNumber);

    const context = this.createPhaseContext(dayNumber, sessionLength);
    const strategy = new DayPhaseStrategy();
    this.phaseManager.startPhase(strategy, context);
  }

  /**
   * Starts a night session where players use night abilities and factions coordinate
   * @param nightNumber Current night number
   * @param sessionLength Base session length (nights are always fixed duration)
   */
  startNightSession(nightNumber: number, sessionLength: number) {
    this.stateManager.setCurrentPhase(Time.Night);
    this.stateManager.setDayNumber(nightNumber);

    const context = this.createPhaseContext(nightNumber, sessionLength);
    const strategy = new NightPhaseStrategy();
    this.phaseManager.startPhase(strategy, context);
  }

  /**
   * Create phase context for phase strategies
   */
  private createPhaseContext(
    dayNumber: number,
    sessionLength: number,
  ): PhaseContext {
    return {
      roomName: this.name,
      socketHandler: this.socketHandler,
      players: [...this.playerRegistry.getAllPlayers()],
      factions: this.factionList,
      sessionLength,
      dayNumber,
      endDay: this.stateManager.getEndDay(),
      confesserVotedOut: this.stateManager.isConjesserVotedOut(),
      framer: this.framer,
      peacemaker: this.peacemaker,
      onPhaseComplete: (nextPhase: Time) => {
        if (nextPhase === Time.Night) {
          this.startNightSession(dayNumber, sessionLength * 0.85);
        } else if (nextPhase === Time.Day) {
          this.startDaySession(dayNumber + 1, sessionLength);
        }
      },
      checkWinCondition: () => this.findWinningFaction(),
      endGame: (winningFaction: string) => this.endGame(winningFaction),
      setEndDay: (day: number) => this.stateManager.setEndDay(day),
    };
  }

  /**
   * Determines which faction has won the game using WinConditionManager
   * @returns Winning faction name or null if game continues
   */
  findWinningFaction() {
    const alivePlayers = this.playerRegistry.getAlivePlayers();
    const allPlayers = [...this.playerRegistry.getAllPlayers()];

    const context: WinConditionContext = {
      alivePlayers,
      allPlayers,
      dayNumber: this.stateManager.getDayNumber(),
      endDay: this.stateManager.getEndDay(),
      confesserVotedOut: this.stateManager.isConjesserVotedOut(),
      framer: this.framer,
      confesser: this.confesser,
      peacemaker: this.peacemaker,
    };

    const result = this.winConditionManager.checkWinConditions(context);

    if (result !== null) {
      this.eventBus.publish({
        type: GameEventType.WIN_CONDITION_CHECKED,
        timestamp: Date.now(),
        data: { result },
      });
      return result.winningFaction;
    }

    return null;
  }

  /**
   * Ends the game and notifies all players of the result
   * @param winningFactionName Name of the winning faction or "nobody" for draw
   */
  endGame(winningFactionName: string) {
    this.stateManager.setGameEnded(true);

    if (winningFactionName == "nobody")
      this.socketHandler.sendRoomMessage(this.name, {
        name: "receiveMessage",
        data: { message: "The game has ended with a draw!" },
      });
    else if (winningFactionName == "neutral")
      this.socketHandler.sendRoomMessage(this.name, {
        name: "receiveMessage",
        data: { message: "The neutral players have won!" },
      });
    else {
      if (winningFactionName.endsWith("s"))
        this.socketHandler.sendRoomMessage(this.name, {
          name: "receiveMessage",
          data: { message: `The ${winningFactionName} have won!` },
        });
      else
        this.socketHandler.sendRoomMessage(this.name, {
          name: "receiveMessage",
          data: { message: `The ${winningFactionName} has won!` },
        });
    }

    this.eventBus.publish({
      type: GameEventType.GAME_ENDED,
      timestamp: Date.now(),
      data: { winningFaction: winningFactionName },
    });

    this.socketHandler.sendRoomMessage(this.name, {
      name: "receiveMessage",
      data: { message: "Closing the room!" },
    });
    this.socketHandler.sendRoomMessage(this.name, {
      name: "blockMessages",
    });
    this.socketHandler.disconnectSockets(this.name);

    // Cleanup
    this.phaseManager.cleanup();
  }
}
