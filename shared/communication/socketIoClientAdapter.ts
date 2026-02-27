/**
 * Socket.IO implementation of the GameSocket interface.
 * Wraps a socket.io-client Socket with the unified API.
 */
import type { GameSocket } from "./clientTypes";

/**
 * Wraps a socket.io-client Socket instance to conform to GameSocket.
 * The underlying socket.io-client Socket is passed in - this adapter
 * simply delegates all calls to it.
 */
export class SocketIoClientAdapter implements GameSocket {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private socket: {
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler?: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    connect(): void;
    disconnect(): void;
    readonly id: string | undefined;
    readonly connected: boolean;
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  constructor(socket: unknown) {
    this.socket = socket as typeof this.socket;
  }

  on(event: string, handler: (...args: any[]) => void): void {
    this.socket.on(event, handler);
  }

  off(event: string, handler?: (...args: any[]) => void): void {
    this.socket.off(event, handler);
  }

  emit(event: string, ...args: any[]): void {
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
