import type {
  DisconnectTarget,
  EmitTarget,
  GameEmitter,
} from "@mernmafia/shared/communication/serverTypes";
import { PartyKitMessageType } from "@mernmafia/shared/communication/events";
import {
  createSupabaseRoomChannelName,
  createSupabaseSocketChannelName,
  SUPABASE_DELIVERY_EVENT,
  SUPABASE_DISCONNECT_EVENT,
} from "@mernmafia/shared/communication/supabaseRealtime";

export type SupabaseEmitterChannelLike = {
  send(message: {
    type: "broadcast";
    event: string;
    payload: unknown;
  }): Promise<unknown> | unknown;
};

export type SupabaseEmitterClientLike = {
  channel(name: string): SupabaseEmitterChannelLike;
};

export class SupabaseEmitter implements GameEmitter {
  private readonly roomNames = new Set<string>();

  constructor(private readonly client: SupabaseEmitterClientLike) {}

  registerRoom(roomName: string): void {
    this.roomNames.add(roomName);
  }

  emitCallback(socketId: string, callbackId: string, args: unknown[]): void {
    this.publish(
      createSupabaseSocketChannelName(socketId),
      SUPABASE_DELIVERY_EVENT,
      {
        type: PartyKitMessageType.Callback,
        callbackId,
        args,
      },
    );
  }

  to(target: string): EmitTarget {
    return {
      emit: (event: string, ...args: unknown[]) => {
        this.publish(this.resolveTargetChannel(target), SUPABASE_DELIVERY_EVENT, {
          type: PartyKitMessageType.Event,
          event,
          args,
        });
      },
    };
  }

  in(target: string): DisconnectTarget {
    return {
      disconnectSockets: () => {
        this.publish(
          createSupabaseRoomChannelName(target),
          SUPABASE_DISCONNECT_EVENT,
          { roomId: target },
        );
      },
    };
  }

  private resolveTargetChannel(target: string): string {
    if (target.startsWith("sb_") && !this.roomNames.has(target)) {
      return createSupabaseSocketChannelName(target);
    }
    return createSupabaseRoomChannelName(target);
  }

  private publish(channelName: string, event: string, payload: unknown): void {
    void this.client.channel(channelName).send({
      type: "broadcast",
      event,
      payload,
    });
  }
}
