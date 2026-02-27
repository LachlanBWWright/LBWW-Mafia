/**
 * Factory function to create the appropriate GameSocket client
 * based on the configured backend type.
 *
 * Usage:
 *   import { createGameSocket } from "@mernmafia/shared/communication/createGameSocket";
 *   const socket = createGameSocket({
 *     type: "socketio",  // or "partykit"
 *     url: "http://localhost:8000",
 *     room: "my-room",   // required for partykit
 *     autoConnect: false,
 *   });
 */
import type { GameSocket, GameSocketConfig } from "./clientTypes";
import { SocketIoClientAdapter } from "./socketIoClientAdapter";
import { PartykitClientAdapter } from "./partykitClientAdapter";

/**
 * Creates a backend-appropriate GameSocket instance.
 *
 * For Socket.IO: requires socket.io-client to be available.
 *   Dynamically imports it to avoid bundling issues when using PartyKit.
 *
 * For PartyKit: uses the built-in PartykitClientAdapter which wraps
 *   a standard WebSocket with the JSON event protocol.
 *
 * @param socketIo - For Socket.IO backend, pass the `io` function from socket.io-client.
 *   Accepts any function signature since socket.io-client's `io` overloads vary by version.
 */
export function createGameSocket(
  config: GameSocketConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  socketIo?: (...args: any[]) => any,
): GameSocket {
  switch (config.type) {
    case "socketio": {
      if (!socketIo) {
        throw new Error(
          "Socket.IO backend requires the `io` function from socket.io-client as the second argument.",
        );
      }
      const rawSocket = socketIo(config.url, {
        autoConnect: config.autoConnect ?? true,
      });
      return new SocketIoClientAdapter(rawSocket);
    }

    case "partykit": {
      const wsUrl = config.url.replace(/^http/, "ws");
      const room = config.room ?? "default";
      const fullUrl = `${wsUrl}/party/${room}`;
      return new PartykitClientAdapter(fullUrl, config.autoConnect ?? true);
    }

    default:
      throw new Error(`Unknown socket backend type: ${String(config.type)}`);
  }
}
