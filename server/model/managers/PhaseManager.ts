import { Time } from "../../../shared/socketTypes/socketTypes.js";
import type { Player } from "../player/player.js";
import type { Faction } from "../factions/abstractFaction.js";
import type { SocketHandler } from "../socketHandler/socketHandler.js";
import type { Framer } from "../roles/neutral/framer.js";
import type { Peacemaker } from "../roles/neutral/peacemaker.js";
import { RoleName } from "../../../shared/roles/roleEnums.js";
import {
  FIRST_DAY_DURATION,
  MINIMUM_DAY_DURATION,
  NIGHT_DURATION,
  DEATH_EXTENSION_DAYS,
} from "../../constants/gameConstants.js";

/**
 * Context for phase strategies
 */
export interface PhaseContext {
  roomName: string;
  socketHandler: SocketHandler;
  players: Player[];
  factions: Faction[];
  sessionLength: number;
  dayNumber: number;
  endDay: number;
  confesserVotedOut: boolean;
  framer: Framer | null;
  peacemaker: Peacemaker | null;
  onPhaseComplete: (nextPhase: Time) => void;
  checkWinCondition: () => string | null;
  endGame: (winningFaction: string) => void;
  setEndDay: (day: number) => void;
}

/**
 * Interface for phase strategies
 */
export interface PhaseStrategy {
  /**
   * Called when entering this phase
   */
  onEnter(context: PhaseContext): void;

  /**
   * Called when exiting this phase
   */
  onExit(context: PhaseContext): void;

  /**
   * Get the phase name
   */
  getName(): Time;
}

/**
 * First day phase strategy (shortened duration)
 */
export class FirstDayPhaseStrategy implements PhaseStrategy {
  getName(): Time {
    return Time.Day;
  }

  onEnter(context: PhaseContext): void {
    const dayMessage = {
      name: "receiveMessage" as const,
      data: { message: "Day 1 has started." },
    };
    const updateDay = {
      name: "update-day-time" as const,
      data: { time: Time.Day, dayNumber: 1, timeLeft: 5 },
    };

    console.debug("FirstDayPhase: broadcasting day start", {
      roomName: context.roomName,
    });

    context.socketHandler.sendRoomMessage(context.roomName, dayMessage);
    context.socketHandler.sendRoomMessage(context.roomName, updateDay);

    // Also send per-player messages for PartyKit compatibility
    for (const player of context.players) {
      context.socketHandler.sendPlayerMessage(player.socketId, dayMessage);
      context.socketHandler.sendPlayerMessage(player.socketId, updateDay);
    }

    // Schedule phase transition
    setTimeout(() => {
      this.onExit(context);
    }, FIRST_DAY_DURATION);
  }

  onExit(context: PhaseContext): void {
    try {
      for (const player of context.players) {
        if (player.isAlive) {
          player.role.dayVisit();
        }
      }

      context.socketHandler.sendRoomMessage(context.roomName, {
        name: "receiveMessage",
        data: { message: "Night 1 has started." },
      });
    } catch (error) {
      console.error("Error in FirstDayPhase exit:", error);
    }

    context.onPhaseComplete(Time.Night);
  }
}

/**
 * Day phase strategy
 */
export class DayPhaseStrategy implements PhaseStrategy {
  getName(): Time {
    return Time.Day;
  }

  onEnter(context: PhaseContext): void {
    const { dayNumber, endDay } = context;

    // Check if game should end due to no deaths
    if (endDay <= dayNumber) {
      context.socketHandler.sendRoomMessage(context.roomName, {
        name: "receiveMessage",
        data: {
          message:
            "Nobody has died in three consecutive days, so the game has ended.",
        },
      });

      if (context.peacemaker !== null) {
        context.peacemaker.victoryCondition = true;
        context.socketHandler.sendPlayerMessage(
          context.peacemaker.player.socketId,
          {
            name: "receiveMessage",
            data: { message: "You have won the game by causing a tie!" },
          },
        );
      }

      context.endGame("nobody");
      return;
    } else if (endDay - 1 <= dayNumber) {
      context.socketHandler.sendRoomMessage(context.roomName, {
        name: "receiveMessage",
        data: {
          message:
            "The game will end in a draw if nobody dies today or tonight.",
        },
      });
    }

    // Broadcast day start
    const dateTimeJson = {
      time: Time.Day,
      dayNumber: dayNumber,
      timeLeft: Math.floor(context.sessionLength / 1000 + 10),
    };

    context.socketHandler.sendRoomMessage(context.roomName, {
      name: "update-day-time",
      data: dateTimeJson,
    });

    context.socketHandler.sendRoomMessage(context.roomName, {
      name: "receiveMessage",
      data: { message: `Day ${String(dayNumber)} has started.` },
    });

    // Update living players
    const livingPlayerList: Player[] = [];
    for (const player of context.players) {
      if (player.isAlive) {
        player.role.dayUpdate();
        player.hasVoted = false;
        player.votesReceived = 0;
        livingPlayerList.push(player);
      }
    }

    const votesRequired = Math.floor(livingPlayerList.length / 2) + 1;
    context.socketHandler.sendRoomMessage(context.roomName, {
      name: "receiveMessage",
      data: {
        message:
          `It takes ${String(votesRequired)} votes for the town to kill a player.`,
      },
    });

    // Schedule phase transition
    setTimeout(() => {
      this.onExit(context);
    }, context.sessionLength + MINIMUM_DAY_DURATION);
  }

  onExit(context: PhaseContext): void {
    try {
      const livingPlayers = context.players.filter((p) => p.isAlive);
      const votesRequired = Math.floor(livingPlayers.length / 2) + 1;

      // Handle execution if majority reached
      if (!context.confesserVotedOut) {
        for (const livingPlayer of livingPlayers) {
          if (livingPlayer.votesReceived >= votesRequired) {
            context.setEndDay(context.dayNumber + DEATH_EXTENSION_DAYS);

            if (livingPlayer.role.name === RoleName.Confesser) {
              context.socketHandler.sendRoomMessage(context.roomName, {
                name: "receiveMessage",
                data: {
                  message:
                    livingPlayer.playerUsername +
                    " was a confesser! Voting has been disabled for the remainder of the game.",
                },
              });
              // confesserVotedOut will be handled by Room
              context.socketHandler.sendRoomMessage(context.roomName, {
                name: "disable-voting",
              });
            } else {
              context.socketHandler.sendRoomMessage(context.roomName, {
                name: "receiveMessage",
                data: {
                  message:
                    livingPlayer.playerUsername +
                    " has been voted out by the town.",
                },
              });
            }

            context.socketHandler.sendPlayerMessage(livingPlayer.socketId, {
              name: "receiveMessage",
              data: { message: "You have been voted out of the town." },
            });
            context.socketHandler.sendPlayerMessage(livingPlayer.socketId, {
              name: "blockMessages",
            });

            livingPlayer.isAlive = false;
            context.socketHandler.sendRoomMessage(context.roomName, {
              name: "update-player-role",
              data: { name: livingPlayer.playerUsername },
            });

            // Check framer win condition
            if (
              context.framer !== null &&
              context.framer.target === livingPlayer
            ) {
              context.framer.victoryCondition = true;
              context.socketHandler.sendPlayerMessage(
                context.framer.player.socketId,
                {
                  name: "receiveMessage",
                  data: {
                    message:
                      "You have successfully gotten your target voted out!",
                  },
                },
              );
            }
          }
        }
      }

      context.socketHandler.sendRoomMessage(context.roomName, {
        name: "receiveMessage",
        data: { message: `Night ${String(context.dayNumber)} has started.` },
      });

      // Handle day visits
      for (const player of context.players) {
        if (player.isAlive) {
          player.role.dayVisit();
          player.role.dayTapped = false;
          player.hasVoted = false;
        }
      }
    } catch (error) {
      console.error("Error in DayPhase exit:", error);
    }

    // Check win condition before transitioning
    const winningFaction = context.checkWinCondition();
    if (winningFaction !== null) {
      context.endGame(winningFaction);
    } else {
      context.onPhaseComplete(Time.Night);
    }
  }
}

/**
 * Night phase strategy
 */
export class NightPhaseStrategy implements PhaseStrategy {
  getName(): Time {
    return Time.Night;
  }

  onEnter(context: PhaseContext): void {
    context.socketHandler.sendRoomMessage(context.roomName, {
      name: "update-day-time",
      data: {
        time: Time.Night,
        dayNumber: context.dayNumber,
        timeLeft: 15,
      },
    });

    // Schedule phase transition
    setTimeout(() => {
      this.onExit(context);
    }, NIGHT_DURATION);
  }

  onExit(context: PhaseContext): void {
    try {
      // Lock phase to prevent visit changes
      // This is handled by Room setting time to Time.Locked

      // Handle factional decisions
      for (const faction of context.factions) {
        faction.removeMembers();
        faction.handleNightVote();
      }

      // Roleblocking classes go first
      for (const player of context.players) {
        if (player.role.roleblocker) {
          player.role.visit();
        }
      }

      // Handle visits for roleblocked players
      for (const player of context.players) {
        if (player.role.roleblocked && !player.role.roleblocker) {
          player.role.visiting = null;
          context.socketHandler.sendPlayerMessage(player.socketId, {
            name: "receiveMessage",
            data: { message: "You were roleblocked!" },
          });
          player.role.roleblocked = false;
        } else if (player.role.visiting != null && !player.role.roleblocker) {
          player.role.visit();
        }
      }

      // Execute visit effects
      for (const player of context.players) {
        if (player.isAlive) {
          player.role.handleVisits();
        }
      }

      // Handle damage and reset visits
      for (const player of context.players) {
        if (player.isAlive) {
          if (player.role.handleDamage()) {
            context.setEndDay(context.dayNumber + DEATH_EXTENSION_DAYS);
          }
          player.role.dayVisiting = null;
          player.role.visiting = null;
          player.role.roleblocked = false;
          player.role.visitors = [];
          player.role.nightTapped = false;
        }
      }
    } catch (error) {
      console.error("Error in NightPhase exit:", error);
    }

    // Check win condition before transitioning
    const winningFaction = context.checkWinCondition();
    if (winningFaction !== null) {
      context.endGame(winningFaction);
    } else {
      context.onPhaseComplete(Time.Day);
    }
  }
}

/**
 * Phase manager using Strategy pattern for phase management
 */
export class PhaseManager {
  private currentStrategy: PhaseStrategy | null = null;
  private timeoutHandle: NodeJS.Timeout | null = null;

  /**
   * Start a phase with the given strategy
   */
  startPhase(strategy: PhaseStrategy, context: PhaseContext): void {
    // Clear any existing timeout
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    // Exit current phase if exists
    if (this.currentStrategy !== null) {
      try {
        this.currentStrategy.onExit(context);
      } catch (error) {
        console.error("Error exiting phase:", error);
      }
    }

    // Enter new phase
    this.currentStrategy = strategy;
    try {
      this.currentStrategy.onEnter(context);
    } catch (error) {
      console.error("Error entering phase:", error);
    }
  }

  /**
   * Get the current phase strategy
   */
  getCurrentStrategy(): PhaseStrategy | null {
    return this.currentStrategy;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.timeoutHandle !== null) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    this.currentStrategy = null;
  }
}
