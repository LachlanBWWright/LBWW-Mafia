import { createClient } from "@supabase/supabase-js";
import type { GameSocket } from "./clientTypes";
import type {
  ClientToServerEvents,
  JoinRoomResult,
  ServerToClientEvents,
} from "./events";
import { PartyKitMessageType, ServerEvent } from "./events";
import {
  gameMessagePayloadSchema,
  joinRoomCallbackArgsSchema,
  partykitServerEnvelopeSchema,
  playerListPayloadSchema,
  playerNamePayloadSchema,
  playerReturnedPayloadSchema,
  updateDayTimePayloadSchema,
  updateFactionRolePayloadSchema,
  updatePlayerRolePayloadSchema,
} from "./protocol";
import {
  createSupabaseRoomChannelName,
  createSupabaseSocketChannelName,
  SUPABASE_CONTROL_CHANNEL,
  SUPABASE_CONTROL_EVENT,
  SUPABASE_DELIVERY_EVENT,
  SUPABASE_DISCONNECT_EVENT,
} from "./supabaseRealtime";

type AckCallback = (result: JoinRoomResult) => void;

export type SupabaseBroadcastPayload = {
  payload: unknown;
};

export type SupabaseChannelLike = {
  on(
    type: "broadcast",
    filter: { event: string },
    callback: (payload: SupabaseBroadcastPayload) => void,
  ): SupabaseChannelLike;
  subscribe(callback?: (status: string) => void): unknown;
  send(message: {
    type: "broadcast";
    event: string;
    payload: unknown;
  }): Promise<unknown> | unknown;
  unsubscribe(): Promise<unknown> | unknown;
};

export type SupabaseClientLike = {
  channel(name: string): SupabaseChannelLike;
  removeChannel?(channel: SupabaseChannelLike): Promise<unknown> | unknown;
};

function isAckCallback(value: unknown): value is AckCallback {
  return typeof value === "function";
}

function isTypedHandler<T extends Function>(value: unknown): value is T {
  return typeof value === "function";
}

function createSocketId(): string {
  return `sb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createSupabaseRealtimeClient(
  url: string,
  apiKey: string,
): SupabaseClientLike {
  return createClient(url, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as unknown as SupabaseClientLike;
}

export class SupabaseRealtimeClientAdapter implements GameSocket {
  private readonly listeners = {
    receiveMessage: new Set<ServerToClientEvents["receiveMessage"]>(),
    blockMessages: new Set<ServerToClientEvents["blockMessages"]>(),
    "receive-new-player": new Set<ServerToClientEvents["receive-new-player"]>(),
    "remove-player": new Set<ServerToClientEvents["remove-player"]>(),
    "receive-player-list": new Set<ServerToClientEvents["receive-player-list"]>(),
    "receive-chat-message": new Set<
      ServerToClientEvents["receive-chat-message"]
    >(),
    "receive-whisper-message": new Set<
      ServerToClientEvents["receive-whisper-message"]
    >(),
    "update-day-time": new Set<ServerToClientEvents["update-day-time"]>(),
    "disable-voting": new Set<ServerToClientEvents["disable-voting"]>(),
    "update-player-role": new Set<ServerToClientEvents["update-player-role"]>(),
    "assign-player-role": new Set<ServerToClientEvents["assign-player-role"]>(),
    "update-faction-role": new Set<
      ServerToClientEvents["update-faction-role"]
    >(),
    "receive-role": new Set<ServerToClientEvents["receive-role"]>(),
    "update-player-visit": new Set<ServerToClientEvents["update-player-visit"]>(),
  };
  private readonly pendingCallbacks = new Map<string, AckCallback>();
  private readonly socketId: string;
  private readonly controlChannelName = SUPABASE_CONTROL_CHANNEL;
  private readonly roomChannelName: string;
  private readonly socketChannelName: string;
  private callbackCounter = 0;
  private controlChannel: SupabaseChannelLike | null = null;
  private roomChannel: SupabaseChannelLike | null = null;
  private socketChannel: SupabaseChannelLike | null = null;
  private _connected = false;

  constructor(
    private readonly client: SupabaseClientLike,
    private readonly roomId: string,
    autoConnect = true,
    socketId = createSocketId(),
  ) {
    this.socketId = socketId;
    this.roomChannelName = createSupabaseRoomChannelName(roomId);
    this.socketChannelName = createSupabaseSocketChannelName(socketId);
    if (autoConnect) {
      this.connect();
    }
  }

  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K],
  ): void;
  on(event: keyof ServerToClientEvents, handler: unknown): void {
    switch (event) {
      case ServerEvent.ReceiveMessage:
        if (isTypedHandler<ServerToClientEvents["receiveMessage"]>(handler)) {
          this.listeners.receiveMessage.add(handler);
        }
        break;
      case ServerEvent.BlockMessages:
        if (isTypedHandler<ServerToClientEvents["blockMessages"]>(handler)) {
          this.listeners.blockMessages.add(handler);
        }
        break;
      case ServerEvent.ReceiveNewPlayer:
        if (isTypedHandler<ServerToClientEvents["receive-new-player"]>(handler)) {
          this.listeners["receive-new-player"].add(handler);
        }
        break;
      case ServerEvent.RemovePlayer:
        if (isTypedHandler<ServerToClientEvents["remove-player"]>(handler)) {
          this.listeners["remove-player"].add(handler);
        }
        break;
      case ServerEvent.ReceivePlayerList:
        if (isTypedHandler<ServerToClientEvents["receive-player-list"]>(handler)) {
          this.listeners["receive-player-list"].add(handler);
        }
        break;
      case ServerEvent.ReceiveChatMessage:
        if (isTypedHandler<ServerToClientEvents["receive-chat-message"]>(handler)) {
          this.listeners["receive-chat-message"].add(handler);
        }
        break;
      case ServerEvent.ReceiveWhisperMessage:
        if (
          isTypedHandler<ServerToClientEvents["receive-whisper-message"]>(handler)
        ) {
          this.listeners["receive-whisper-message"].add(handler);
        }
        break;
      case ServerEvent.UpdateDayTime:
        if (isTypedHandler<ServerToClientEvents["update-day-time"]>(handler)) {
          this.listeners["update-day-time"].add(handler);
        }
        break;
      case ServerEvent.DisableVoting:
        if (isTypedHandler<ServerToClientEvents["disable-voting"]>(handler)) {
          this.listeners["disable-voting"].add(handler);
        }
        break;
      case ServerEvent.UpdatePlayerRole:
        if (isTypedHandler<ServerToClientEvents["update-player-role"]>(handler)) {
          this.listeners["update-player-role"].add(handler);
        }
        break;
      case ServerEvent.AssignPlayerRole:
        if (isTypedHandler<ServerToClientEvents["assign-player-role"]>(handler)) {
          this.listeners["assign-player-role"].add(handler);
        }
        break;
      case ServerEvent.UpdateFactionRole:
        if (
          isTypedHandler<ServerToClientEvents["update-faction-role"]>(handler)
        ) {
          this.listeners["update-faction-role"].add(handler);
        }
        break;
      case ServerEvent.ReceiveRole:
        if (isTypedHandler<ServerToClientEvents["receive-role"]>(handler)) {
          this.listeners["receive-role"].add(handler);
        }
        break;
      case ServerEvent.UpdatePlayerVisit:
        if (isTypedHandler<ServerToClientEvents["update-player-visit"]>(handler)) {
          this.listeners["update-player-visit"].add(handler);
        }
        break;
    }
  }

  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler?: ServerToClientEvents[K],
  ): void;
  off(event: keyof ServerToClientEvents, handler?: unknown): void {
    if (!handler) {
      switch (event) {
        case ServerEvent.ReceiveMessage:
          this.listeners.receiveMessage.clear();
          break;
        case ServerEvent.BlockMessages:
          this.listeners.blockMessages.clear();
          break;
        case ServerEvent.ReceiveNewPlayer:
          this.listeners["receive-new-player"].clear();
          break;
        case ServerEvent.RemovePlayer:
          this.listeners["remove-player"].clear();
          break;
        case ServerEvent.ReceivePlayerList:
          this.listeners["receive-player-list"].clear();
          break;
        case ServerEvent.ReceiveChatMessage:
          this.listeners["receive-chat-message"].clear();
          break;
        case ServerEvent.ReceiveWhisperMessage:
          this.listeners["receive-whisper-message"].clear();
          break;
        case ServerEvent.UpdateDayTime:
          this.listeners["update-day-time"].clear();
          break;
        case ServerEvent.DisableVoting:
          this.listeners["disable-voting"].clear();
          break;
        case ServerEvent.UpdatePlayerRole:
          this.listeners["update-player-role"].clear();
          break;
        case ServerEvent.AssignPlayerRole:
          this.listeners["assign-player-role"].clear();
          break;
        case ServerEvent.UpdateFactionRole:
          this.listeners["update-faction-role"].clear();
          break;
        case ServerEvent.ReceiveRole:
          this.listeners["receive-role"].clear();
          break;
        case ServerEvent.UpdatePlayerVisit:
          this.listeners["update-player-visit"].clear();
          break;
      }
      return;
    }

    switch (event) {
      case ServerEvent.ReceiveMessage:
        if (isTypedHandler<ServerToClientEvents["receiveMessage"]>(handler)) {
          this.listeners.receiveMessage.delete(handler);
        }
        break;
      case ServerEvent.BlockMessages:
        if (isTypedHandler<ServerToClientEvents["blockMessages"]>(handler)) {
          this.listeners.blockMessages.delete(handler);
        }
        break;
      case ServerEvent.ReceiveNewPlayer:
        if (isTypedHandler<ServerToClientEvents["receive-new-player"]>(handler)) {
          this.listeners["receive-new-player"].delete(handler);
        }
        break;
      case ServerEvent.RemovePlayer:
        if (isTypedHandler<ServerToClientEvents["remove-player"]>(handler)) {
          this.listeners["remove-player"].delete(handler);
        }
        break;
      case ServerEvent.ReceivePlayerList:
        if (isTypedHandler<ServerToClientEvents["receive-player-list"]>(handler)) {
          this.listeners["receive-player-list"].delete(handler);
        }
        break;
      case ServerEvent.ReceiveChatMessage:
        if (isTypedHandler<ServerToClientEvents["receive-chat-message"]>(handler)) {
          this.listeners["receive-chat-message"].delete(handler);
        }
        break;
      case ServerEvent.ReceiveWhisperMessage:
        if (
          isTypedHandler<ServerToClientEvents["receive-whisper-message"]>(handler)
        ) {
          this.listeners["receive-whisper-message"].delete(handler);
        }
        break;
      case ServerEvent.UpdateDayTime:
        if (isTypedHandler<ServerToClientEvents["update-day-time"]>(handler)) {
          this.listeners["update-day-time"].delete(handler);
        }
        break;
      case ServerEvent.DisableVoting:
        if (isTypedHandler<ServerToClientEvents["disable-voting"]>(handler)) {
          this.listeners["disable-voting"].delete(handler);
        }
        break;
      case ServerEvent.UpdatePlayerRole:
        if (isTypedHandler<ServerToClientEvents["update-player-role"]>(handler)) {
          this.listeners["update-player-role"].delete(handler);
        }
        break;
      case ServerEvent.AssignPlayerRole:
        if (isTypedHandler<ServerToClientEvents["assign-player-role"]>(handler)) {
          this.listeners["assign-player-role"].delete(handler);
        }
        break;
      case ServerEvent.UpdateFactionRole:
        if (
          isTypedHandler<ServerToClientEvents["update-faction-role"]>(handler)
        ) {
          this.listeners["update-faction-role"].delete(handler);
        }
        break;
      case ServerEvent.ReceiveRole:
        if (isTypedHandler<ServerToClientEvents["receive-role"]>(handler)) {
          this.listeners["receive-role"].delete(handler);
        }
        break;
      case ServerEvent.UpdatePlayerVisit:
        if (isTypedHandler<ServerToClientEvents["update-player-visit"]>(handler)) {
          this.listeners["update-player-visit"].delete(handler);
        }
        break;
    }
  }

  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    if (!this.controlChannel || !this._connected) {
      return;
    }

    let serializableArgs: unknown = args;
    let callbackId: string | undefined;
    const possibleCallback = args[args.length - 1];
    if (isAckCallback(possibleCallback)) {
      callbackId = `cb_${++this.callbackCounter}`;
      this.pendingCallbacks.set(callbackId, possibleCallback);
      serializableArgs = args.slice(0, -1);
    }

    void this.controlChannel.send({
      type: "broadcast",
      event: SUPABASE_CONTROL_EVENT,
      payload: {
        roomId: this.roomId,
        socketId: this.socketId,
        message: {
          type: PartyKitMessageType.Event,
          event,
          args: serializableArgs,
          ...(callbackId ? { callbackId } : {}),
        },
      },
    });
  }

  connect(onOpen?: () => void): void {
    if (this._connected) {
      onOpen?.();
      return;
    }

    let subscribedCount = 0;
    const totalSubscriptions = 3;
    const handleSubscribed = (status: string) => {
      if (status !== "SUBSCRIBED") {
        return;
      }
      subscribedCount += 1;
      if (subscribedCount >= totalSubscriptions) {
        this._connected = true;
        onOpen?.();
      }
    };

    this.controlChannel = this.client.channel(this.controlChannelName);
    this.roomChannel = this.client
      .channel(this.roomChannelName)
      .on("broadcast", { event: SUPABASE_DELIVERY_EVENT }, (payload) => {
        this.handleDeliveryPayload(payload.payload);
      })
      .on("broadcast", { event: SUPABASE_DISCONNECT_EVENT }, () => {
        this.disconnect(false);
      });
    this.socketChannel = this.client
      .channel(this.socketChannelName)
      .on("broadcast", { event: SUPABASE_DELIVERY_EVENT }, (payload) => {
        this.handleDeliveryPayload(payload.payload);
      })
      .on("broadcast", { event: SUPABASE_DISCONNECT_EVENT }, () => {
        this.disconnect(false);
      });

    this.controlChannel.subscribe(handleSubscribed);
    this.roomChannel.subscribe(handleSubscribed);
    this.socketChannel.subscribe(handleSubscribed);
  }

  disconnect(emitDisconnect = true): void {
    if (emitDisconnect && this.controlChannel && this._connected) {
      void this.controlChannel.send({
        type: "broadcast",
        event: SUPABASE_CONTROL_EVENT,
        payload: {
          roomId: this.roomId,
          socketId: this.socketId,
          message: {
            type: PartyKitMessageType.Event,
            event: "disconnect",
            args: [],
          },
        },
      });
    }

    for (const channel of [
      this.controlChannel,
      this.roomChannel,
      this.socketChannel,
    ]) {
      if (!channel) {
        continue;
      }
      void channel.unsubscribe();
      void this.client.removeChannel?.(channel);
    }

    this.controlChannel = null;
    this.roomChannel = null;
    this.socketChannel = null;
    this._connected = false;
    this.pendingCallbacks.clear();
  }

  get id(): string | undefined {
    return this.socketId;
  }

  get connected(): boolean {
    return this._connected;
  }

  private handleDeliveryPayload(payload: unknown): void {
    const parsed = partykitServerEnvelopeSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    if (parsed.data.type === PartyKitMessageType.Callback) {
      const callbackArgs = joinRoomCallbackArgsSchema.safeParse(parsed.data.args);
      const callback = this.pendingCallbacks.get(parsed.data.callbackId);
      this.pendingCallbacks.delete(parsed.data.callbackId);
      if (callback && callbackArgs.success) {
        callback(callbackArgs.data[0]);
      }
      return;
    }

    this.dispatchEvent(parsed.data.event, parsed.data.args);
  }

  private dispatchEvent(event: string, args: unknown[]): void {
    switch (event) {
      case ServerEvent.ReceiveMessage: {
        const parsed = gameMessagePayloadSchema.safeParse(args[0]);
        if (parsed.success) {
          for (const handler of this.listeners.receiveMessage) {
            handler(parsed.data);
          }
        }
        break;
      }
      case ServerEvent.ReceiveChatMessage:
      case ServerEvent.ReceiveWhisperMessage:
      case ServerEvent.ReceiveRole: {
        const [message] = args;
        if (typeof message === "string") {
          for (const handler of this.listeners[event]) {
            handler(message);
          }
        }
        break;
      }
      case ServerEvent.BlockMessages:
      case ServerEvent.DisableVoting:
      case ServerEvent.UpdatePlayerVisit: {
        for (const handler of this.listeners[event]) {
          handler();
        }
        break;
      }
      case ServerEvent.ReceiveNewPlayer:
      case ServerEvent.RemovePlayer: {
        const parsed = playerNamePayloadSchema.safeParse(args[0]);
        if (parsed.success) {
          for (const handler of this.listeners[event]) {
            handler(parsed.data);
          }
        }
        break;
      }
      case ServerEvent.ReceivePlayerList: {
        const parsed = playerListPayloadSchema.safeParse(args[0]);
        if (parsed.success) {
          for (const handler of this.listeners["receive-player-list"]) {
            handler(parsed.data);
          }
        }
        break;
      }
      case ServerEvent.UpdateDayTime: {
        const parsed = updateDayTimePayloadSchema.safeParse(args[0]);
        if (parsed.success) {
          for (const handler of this.listeners["update-day-time"]) {
            handler(parsed.data);
          }
        }
        break;
      }
      case ServerEvent.UpdatePlayerRole: {
        const parsed = updatePlayerRolePayloadSchema.safeParse(args[0]);
        if (parsed.success) {
          for (const handler of this.listeners["update-player-role"]) {
            handler(parsed.data);
          }
        }
        break;
      }
      case ServerEvent.AssignPlayerRole: {
        const parsed = playerReturnedPayloadSchema.safeParse(args[0]);
        if (parsed.success) {
          for (const handler of this.listeners["assign-player-role"]) {
            handler(parsed.data);
          }
        }
        break;
      }
      case ServerEvent.UpdateFactionRole: {
        const parsed = updateFactionRolePayloadSchema.safeParse(args[0]);
        if (parsed.success) {
          for (const handler of this.listeners["update-faction-role"]) {
            handler(parsed.data);
          }
        }
        break;
      }
    }
  }
}
