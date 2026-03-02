/**
 * Socket.IO implementation of the GameSocket interface.
 * Wraps a socket.io-client Socket typed to the game's event maps.
 */
import type { GameSocket } from "./clientTypes";
import type { ServerToClientEvents, ClientToServerEvents } from "./events";

/**
 * Minimal structural interface that socket.io-client's Socket satisfies when
 * created as `io<ServerToClientEvents, ClientToServerEvents>(url, opts)`.
 * Using a local structural type avoids importing socket.io-client in shared.
 */
export type SocketIoCompatible = {
  on<K extends keyof ServerToClientEvents>(
    event: K,
    listener: ServerToClientEvents[K],
  ): unknown;
  off<K extends keyof ServerToClientEvents>(
    event: K,
    listener?: ServerToClientEvents[K],
  ): unknown;
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): unknown;
  connect(): unknown;
  disconnect(): unknown;
  readonly id: string | undefined;
  readonly connected: boolean;
};

export class SocketIoClientAdapter implements GameSocket {
  constructor(private socket: SocketIoCompatible) {}

  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K],
  ): void {
    this.socket.on(event, handler);
  }

  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler?: ServerToClientEvents[K],
  ): void {
    this.socket.off(event, handler);
  }

  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    this.socket.emit(event, ...args);
  }

  connect(): void {
    this.socket.connect();
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  get id(): string | undefined {
    return this.socket.id;
  }

  get connected(): boolean {
    return this.socket.connected;
  }
}
