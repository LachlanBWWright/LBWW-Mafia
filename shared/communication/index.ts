/**
 * Central export point for socket communication types and utilities.
 * Re-exports event types, adapters, and factories for both client and server.
 */
export type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  PlayerList,
  PlayerReturned,
} from "./events";
export { ServerEvent, ClientEvent } from "./events";
export { DayTime } from "../game/playerActionRules";
export type {
  GameEmitter,
  EmitTarget,
  DisconnectTarget,
  GamePlayerSocket,
} from "./serverTypes";
export type {
  GameSocket,
  SocketBackendType,
  GameSocketConfig,
} from "./clientTypes";
export { SocketIoClientAdapter } from "./socketIoClientAdapter";
export { PartykitClientAdapter } from "./partykitClientAdapter";
export { createGameSocket } from "./createGameSocket";
