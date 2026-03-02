/**
 * Factory function to create the appropriate GameSocket client
 * based on the configured backend type.
 *
 * For Socket.IO: pass a pre-created socket (from socket.io-client's `io()` call)
 * as `rawSocket`.
 *
 * For PartyKit: no `rawSocket` needed; the WebSocket URL is derived from `config.url`.
 */
import type { GameSocket, GameSocketConfig } from "./clientTypes";
import { SocketIoClientAdapter, type SocketIoCompatible } from "./socketIoClientAdapter";
import { PartykitClientAdapter } from "./partykitClientAdapter";

export function createGameSocket(
  config: GameSocketConfig,
  rawSocket?: SocketIoCompatible,
): GameSocket {
  switch (config.type) {
    case "socketio": {
      if (!rawSocket) {
        throw new Error(
          "Socket.IO backend requires a pre-created socket passed as the second argument.",
        );
      }
      return new SocketIoClientAdapter(rawSocket);
    }

    case "partykit": {
      const wsUrl = config.url.replace(/^https?/, "ws");
      const room = config.room ?? "default";
      return new PartykitClientAdapter(
        `${wsUrl}/party/${room}`,
        config.autoConnect ?? true,
      );
    }

    default:
      throw new Error(`Unknown socket backend type: ${String(config.type)}`);
  }
}
