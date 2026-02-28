/**
 * Client-side abstractions for socket communication.
 * Both Socket.IO-client and PartySocket implement this interface,
 * allowing NextJS and Mobile apps to be backend-agnostic.
 */

/**
 * Unified client-side socket interface.
 * Wraps either a Socket.IO client or a PartySocket with a consistent event API.
 */
export interface GameSocket {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler?: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  /* eslint-enable @typescript-eslint/no-explicit-any */
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
