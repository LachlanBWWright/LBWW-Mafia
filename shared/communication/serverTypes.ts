/**
 * Server-side abstractions for emitting events to clients.
 * Both Socket.IO and PartyKit backends implement these interfaces,
 * allowing the game logic (Room, Role, Faction) to remain backend-agnostic.
 */

/**
 * Represents a target that can receive emitted events.
 * Returned by `GameEmitter.to()`.
 */
export interface EmitTarget {
  emit(event: string, ...args: unknown[]): void;
}

/**
 * Represents a target whose sockets can be disconnected.
 * Returned by `GameEmitter.in()`.
 */
export interface DisconnectTarget {
  disconnectSockets(): void;
}

/**
 * Core server-side broadcasting interface.
 * Mirrors the subset of Socket.IO's Server API used by the game logic:
 *   io.to(roomOrSocketId).emit(event, data)
 *   io.in(room).disconnectSockets()
 */
export interface GameEmitter {
  to(target: string): EmitTarget;
  in(target: string): DisconnectTarget;
}

/**
 * Represents an individual player's server-side connection.
 * Abstracts away the differences between a Socket.IO Socket and a PartyKit Connection.
 */
export interface GamePlayerSocket {
  readonly id: string;
  data: { roomObject?: unknown; position?: number };
  join(room: string): void;
}
