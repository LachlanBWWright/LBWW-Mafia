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
import {
  createSupabaseRealtimeClient,
  SupabaseRealtimeClientAdapter,
} from "./supabaseRealtimeClientAdapter";
import { ok, err, Result } from "neverthrow";

export function createGameSocket(
  config: GameSocketConfig,
  rawSocket?: SocketIoCompatible,
): Result<GameSocket, Error> {
  switch (config.type) {
    case "socketio": {
      if (!rawSocket) {
        return err(new Error(
          "Socket.IO backend requires a pre-created socket passed as the second argument.",
        ));
      }
      return ok(new SocketIoClientAdapter(rawSocket));
    }

    case "partykit": {
      const wsUrl = config.url.replace(/^http(s?)/, "ws$1");
      const room = config.room ?? "default";
      return ok(new PartykitClientAdapter(
        `${wsUrl}/party/${room}`,
        config.autoConnect ?? true,
      ));
    }

    case "rust": {
      const room = encodeURIComponent(config.room ?? "default");
      const wsUrl = config.url.replace(/^http(s?)/, "ws$1").replace(/\/$/, "");
      return ok(new PartykitClientAdapter(
        `${wsUrl}/ws/${room}`,
        config.autoConnect ?? true,
      ));
    }

    case "supabase": {
      if (!config.apiKey) {
        return err(new Error(
          "Supabase backend requires an anon/public API key in config.apiKey.",
        ));
      }
      const room = config.room ?? "default";
      const client = createSupabaseRealtimeClient(config.url, config.apiKey);
      return ok(new SupabaseRealtimeClientAdapter(
        client,
        room,
        config.autoConnect ?? true,
      ));
    }

    default:
      return err(new Error(`Unknown socket backend type: ${String(config.type)}`));
  }
}
