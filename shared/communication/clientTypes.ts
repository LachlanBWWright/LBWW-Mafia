/**
 * Client-side abstractions for socket communication.
 * Both Socket.IO-client and PartySocket implement this interface,
 * allowing NextJS and Mobile apps to be backend-agnostic.
 */
import type { ServerToClientEvents, ClientToServerEvents } from "./events";

/**
 * Unified client-side socket interface typed against the game's event maps.
 * Wraps either a Socket.IO client or a raw WebSocket with a consistent event API.
 */
export interface GameSocket {
  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K],
  ): void;
  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler?: ServerToClientEvents[K],
  ): void;
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void;
  connect(): void;
  disconnect(): void;
  readonly id: string | undefined;
  readonly connected: boolean;
}

export type SocketBackendType = "socketio" | "partykit";

export interface GameSocketConfig {
  type: SocketBackendType;
  url: string;
  room?: string;
  autoConnect?: boolean;
}
