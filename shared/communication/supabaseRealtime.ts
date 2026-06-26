import { PartyKitMessageType, type ClientEvent } from "./events";

export const SUPABASE_CONTROL_CHANNEL = "mafia:control";
export const SUPABASE_CONTROL_EVENT = "client-event";
export const SUPABASE_DELIVERY_EVENT = "server-message";
export const SUPABASE_DISCONNECT_EVENT = "disconnect";

export function createSupabaseRoomChannelName(roomId: string): string {
  return `mafia:room:${roomId}`;
}

export function createSupabaseSocketChannelName(socketId: string): string {
  return `mafia:socket:${socketId}`;
}

export type SupabaseClientEventEnvelope = {
  roomId: string;
  socketId: string;
  message: {
    type: PartyKitMessageType.Event;
    event: ClientEvent;
    args: unknown[];
    callbackId?: string;
  };
};
