/**
 * Central export point for socket communication types and utilities.
 * Exports event types, adapters, and factories for both client and server.
 */
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  PlayerList,
  PlayerReturned,
} from "./events";
import { ServerEvent, ClientEvent } from "./events";
import { DayTime } from "../game/playerActionRules";
import type {
  GameEmitter,
  EmitTarget,
  DisconnectTarget,
  GamePlayerSocket,
} from "./serverTypes";
import type {
  GameSocket,
  SocketBackendType,
  GameSocketConfig,
} from "./clientTypes";
import { SocketIoClientAdapter } from "./socketIoClientAdapter";
import { PartykitClientAdapter } from "./partykitClientAdapter";
import { createGameSocket } from "./createGameSocket";

export type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  PlayerList,
  PlayerReturned,
  GameEmitter,
  EmitTarget,
  DisconnectTarget,
  GamePlayerSocket,
  GameSocket,
  SocketBackendType,
  GameSocketConfig,
};
export {
  ServerEvent,
  ClientEvent,
  DayTime,
  SocketIoClientAdapter,
  PartykitClientAdapter,
  createGameSocket,
};
