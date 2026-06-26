import { ClientEvent, PartyKitMessageType, ServerEvent } from "@mernmafia/shared/communication/events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseRealtimeServer } from "./supabaseServer.js";
import {
  createSupabaseRoomChannelName,
  createSupabaseSocketChannelName,
  SUPABASE_CONTROL_CHANNEL,
  SUPABASE_CONTROL_EVENT,
  SUPABASE_DELIVERY_EVENT,
} from "../../../shared/communication/supabaseRealtime.js";

type BroadcastHandler = (payload: { payload: unknown }) => void;

class MockChannel {
  readonly handlers = new Map<string, BroadcastHandler[]>();
  readonly sent: Array<{ type: "broadcast"; event: string; payload: unknown }> = [];

  on(
    _type: "broadcast",
    filter: { event: string },
    callback: BroadcastHandler,
  ): MockChannel {
    const handlers = this.handlers.get(filter.event) ?? [];
    handlers.push(callback);
    this.handlers.set(filter.event, handlers);
    return this;
  }

  subscribe(): void {
    return undefined;
  }

  async unsubscribe(): Promise<void> {
    return undefined;
  }

  send(message: { type: "broadcast"; event: string; payload: unknown }): void {
    this.sent.push(message);
  }

  emit(event: string, payload: unknown): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler({ payload });
    }
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Supabase realtime server", () => {
  it("routes join callbacks and room broadcasts through Supabase channels", async () => {
    const channels = new Map<string, MockChannel>();
    const client = {
      channel(name: string) {
        const existing = channels.get(name);
        if (existing) {
          return existing;
        }
        const channel = new MockChannel();
        channels.set(name, channel);
        return channel;
      },
      removeChannel() {
        return undefined;
      },
    };

    const server = createSupabaseRealtimeServer(2, client);
    await server.start();

    channels.get(SUPABASE_CONTROL_CHANNEL)?.emit(SUPABASE_CONTROL_EVENT, {
      roomId: "room-1",
      socketId: "sb_alpha",
      message: {
        type: PartyKitMessageType.Event,
        event: ClientEvent.PlayerJoinRoom,
        args: ["captcha-token"],
        callbackId: "cb_1",
      },
    });

    expect(channels.get(createSupabaseSocketChannelName("sb_alpha"))?.sent[0]).toMatchObject({
      event: SUPABASE_DELIVERY_EVENT,
      payload: {
        type: PartyKitMessageType.Callback,
        callbackId: "cb_1",
        args: [{ status: "joined" }],
      },
    });

    channels.get(SUPABASE_CONTROL_CHANNEL)?.emit(SUPABASE_CONTROL_EVENT, {
      roomId: "room-1",
      socketId: "sb_beta",
      message: {
        type: PartyKitMessageType.Event,
        event: ClientEvent.PlayerJoinRoom,
        args: ["captcha-token"],
        callbackId: "cb_2",
      },
    });

    expect(
      channels.get(createSupabaseRoomChannelName("room-1"))?.sent.some(
        (message) =>
          message.event === SUPABASE_DELIVERY_EVENT &&
          typeof message.payload === "object" &&
          message.payload !== null &&
          "event" in message.payload &&
          (message.payload as { event?: string }).event === ServerEvent.ReceiveMessage,
      ),
    ).toBe(true);
  });

  it("routes explicit disconnect control messages back into room removal", async () => {
    const channels = new Map<string, MockChannel>();
    const client = {
      channel(name: string) {
        const existing = channels.get(name);
        if (existing) {
          return existing;
        }
        const channel = new MockChannel();
        channels.set(name, channel);
        return channel;
      },
      removeChannel() {
        return undefined;
      },
    };

    const server = createSupabaseRealtimeServer(2, client);
    await server.start();

    channels.get(SUPABASE_CONTROL_CHANNEL)?.emit(SUPABASE_CONTROL_EVENT, {
      roomId: "room-2",
      socketId: "sb_gamma",
      message: {
        type: PartyKitMessageType.Event,
        event: ClientEvent.PlayerJoinRoom,
        args: ["captcha-token"],
        callbackId: "cb_1",
      },
    });
    channels.get(SUPABASE_CONTROL_CHANNEL)?.emit(SUPABASE_CONTROL_EVENT, {
      roomId: "room-2",
      socketId: "sb_gamma",
      message: {
        type: PartyKitMessageType.Event,
        event: ClientEvent.Disconnect,
        args: [],
      },
    });

    expect(server.playerSockets.has("sb_gamma")).toBe(false);
  });
});
