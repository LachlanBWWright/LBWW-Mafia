import { createClient } from "@supabase/supabase-js";
import { ClientEvent } from "../../../shared/communication/events.js";
import { supabaseClientEnvelopeSchema } from "../../../shared/communication/protocol.js";
import {
  SUPABASE_CONTROL_CHANNEL,
  SUPABASE_CONTROL_EVENT,
} from "../../../shared/communication/supabaseRealtime.js";
import { Room } from "../../model/rooms/room.js";
import { setGameEmitter } from "../emitter.js";
import {
  parseJoinRoomToken,
  parseMessageSentPayload,
  parseVisitPayload,
  parseVotePayload,
  parseWhisperPayload,
} from "../socketValidation.js";
import {
  SupabaseEmitter,
  type SupabaseEmitterClientLike,
} from "./supabaseEmitter.js";
import { SupabasePlayerSocket } from "./supabasePlayerSocket.js";

export type SupabaseServerChannelLike = {
  on(
    type: "broadcast",
    filter: { event: string },
    callback: (payload: { payload: unknown }) => void,
  ): SupabaseServerChannelLike;
  subscribe(callback?: (status: string) => void): unknown;
  unsubscribe(): Promise<unknown> | unknown;
};

export type SupabaseServerClientLike = SupabaseEmitterClientLike & {
  channel(name: string): SupabaseServerChannelLike;
  removeChannel?(channel: SupabaseServerChannelLike): Promise<unknown> | unknown;
};

export type SupabaseRealtimeServer = {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly emitter: SupabaseEmitter;
  readonly rooms: Map<string, Room>;
  readonly playerSockets: Map<string, SupabasePlayerSocket>;
};

function createSupabaseServerClient(): SupabaseServerClientLike {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the Supabase realtime backend.",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as unknown as SupabaseServerClientLike;
}

export function createSupabaseRealtimeServer(
  roomSize: number,
  client: SupabaseServerClientLike = createSupabaseServerClient(),
): SupabaseRealtimeServer {
  const rooms = new Map<string, Room>();
  const playerSockets = new Map<string, SupabasePlayerSocket>();
  const emitter = new SupabaseEmitter(client);
  const controlChannel = client
    .channel(SUPABASE_CONTROL_CHANNEL)
    .on("broadcast", { event: SUPABASE_CONTROL_EVENT }, ({ payload }) => {
      const parsed = supabaseClientEnvelopeSchema.safeParse(payload);
      if (!parsed.success) {
        return;
      }

      const { roomId, socketId, message } = parsed.data;
      const playerSocket = getOrCreateSocket(socketId);
      const room = getOrCreateRoom(roomId);

      switch (message.event) {
        case ClientEvent.PlayerJoinRoom: {
          const captchaToken = parseJoinRoomToken(message.args[0]);
          if (!captchaToken) {
            return;
          }
          playerSocket.join(room.name);
          playerSocket.data.roomObject = room;
          const result = room.addUser(playerSocket);
          if (message.callbackId) {
            playerSocket.sendCallback(message.callbackId, result);
          }
          return;
        }
        case ClientEvent.Disconnect: {
          playerSocket.data.roomObject?.removePlayer(socketId);
          playerSockets.delete(socketId);
          return;
        }
        case ClientEvent.MessageSentByUser: {
          const payload = parseMessageSentPayload(message.args[0], message.args[1]);
          if (!payload || playerSocket.data.roomObject === undefined) {
            return;
          }
          playerSocket.data.roomObject.handleSentMessage(
            playerSocket,
            payload.message,
            payload.phase,
          );
          return;
        }
        case ClientEvent.HandleVote: {
          const payload = parseVotePayload(message.args[0], message.args[1]);
          if (!payload || playerSocket.data.roomObject === undefined) {
            return;
          }
          playerSocket.data.roomObject.handleVote(
            playerSocket,
            payload.recipient,
            payload.phase,
          );
          return;
        }
        case ClientEvent.HandleVisit: {
          const payload = parseVisitPayload(message.args[0], message.args[1]);
          if (!payload || playerSocket.data.roomObject === undefined) {
            return;
          }
          playerSocket.data.roomObject.handleVisit(
            playerSocket,
            payload.recipient,
            payload.phase,
          );
          return;
        }
        case ClientEvent.HandleWhisper: {
          const payload = parseWhisperPayload(
            message.args[0],
            message.args[1],
            message.args[2],
          );
          if (!payload || playerSocket.data.roomObject === undefined) {
            return;
          }
          playerSocket.data.roomObject.handleWhisper(
            playerSocket,
            payload.recipient,
            payload.message,
            payload.phase,
          );
        }
      }
    });

  setGameEmitter(emitter);

  function getOrCreateRoom(roomId: string): Room {
    const existing = rooms.get(roomId);
    if (existing) {
      return existing;
    }
    const room = new Room(roomSize, roomId);
    rooms.set(roomId, room);
    emitter.registerRoom(room.name);
    return room;
  }

  function getOrCreateSocket(socketId: string): SupabasePlayerSocket {
    const existing = playerSockets.get(socketId);
    if (existing) {
      return existing;
    }
    const socket = new SupabasePlayerSocket(socketId, emitter);
    playerSockets.set(socketId, socket);
    return socket;
  }

  return {
    emitter,
    rooms,
    playerSockets,
    async start(): Promise<void> {
      controlChannel.subscribe();
    },
    async stop(): Promise<void> {
      await controlChannel.unsubscribe();
      await client.removeChannel?.(controlChannel);
    },
  };
}
