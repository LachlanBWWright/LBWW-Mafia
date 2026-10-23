import { MessageKey } from "./messages";
import { retryDelay } from "../reliability/limits";
/**
 * PartyServer implementation of the GameSocket interface.
 * Wraps a WebSocket and translates between the event-based API and the JSON protocol.
 *
 * Protocol:
 *   Client → Server: { type: "event", event: string, args: unknown[], callbackId?: string }
 *   Server → Client: { type: "event", event: string, args: unknown[] }
 *                   | { type: "callback", callbackId: string, args: unknown[] }
 */
import type { GameSocket } from "./clientTypes";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  JoinRoomResult,
} from "./events";
import { PartyServerMessageType, ServerEvent } from "./events";
import {
  gameMessagePayloadSchema,
  gameSnapshotSchema,
  joinRoomCallbackArgsSchema,
  partyserverServerEnvelopeSchema,
  playerListPayloadSchema,
  playerNamePayloadSchema,
  playerReturnedPayloadSchema,
  updateDayTimePayloadSchema,
  updateFactionRolePayloadSchema,
  updatePlayerRolePayloadSchema,
} from "./protocol";

type AckCallback = (result: JoinRoomResult) => void;

function isAckCallback(value: unknown): value is AckCallback {
  return typeof value === "function";
}

function isTypedHandler<T extends Function>(value: unknown): value is T {
  return typeof value === "function";
}

/**
 * PartyServer WebSocket adapter implementing the GameSocket interface.
 * Manages event listeners, callback tracking, and message serialization.
 */
export class PartyServerClientAdapter implements GameSocket {
  private phaseVersion = 0;
  private commandTimer?: ReturnType<typeof setInterval>;
  private pendingCommands = new Map<
    string,
    { envelope: unknown; attempts: number }
  >();
  private ws: WebSocket | null = null;
  private stopped = false;
  private retry = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private readonly resumeKey: string;
  private joinCallback?: AckCallback;
  private joinEnvelope?: { event: string; args: unknown; callbackId?: string };

  private listeners = {
    "game-snapshot": new Set<ServerToClientEvents["game-snapshot"]>(),
    receiveMessage: new Set<ServerToClientEvents["receiveMessage"]>(),
    blockMessages: new Set<ServerToClientEvents["blockMessages"]>(),
    "receive-new-player": new Set<ServerToClientEvents["receive-new-player"]>(),
    "remove-player": new Set<ServerToClientEvents["remove-player"]>(),
    "receive-player-list": new Set<
      ServerToClientEvents["receive-player-list"]
    >(),
    "receive-spectator-message": new Set<
      ServerToClientEvents["receive-spectator-message"]
    >(),
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
    "update-player-visit": new Set<
      ServerToClientEvents["update-player-visit"]
    >(),
  };
  private pendingCallbacks = new Map<string, AckCallback>();
  private callbackCounter = 0;
  private readonly url: string;
  private _id: string | undefined;
  private _connected = false;

  constructor(url: string, autoConnect = true, resumeKey?: string) {
    this.resumeKey = resumeKey ?? crypto.randomUUID();
    this.url = url;
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
      case ServerEvent.GameSnapshot:
        if (isTypedHandler<ServerToClientEvents["game-snapshot"]>(handler))
          this.listeners["game-snapshot"].add(handler);
        break;
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
        if (
          isTypedHandler<ServerToClientEvents["receive-new-player"]>(handler)
        ) {
          this.listeners["receive-new-player"].add(handler);
        }
        break;
      case ServerEvent.RemovePlayer:
        if (isTypedHandler<ServerToClientEvents["remove-player"]>(handler)) {
          this.listeners["remove-player"].add(handler);
        }
        break;
      case ServerEvent.ReceivePlayerList:
        if (
          isTypedHandler<ServerToClientEvents["receive-player-list"]>(handler)
        ) {
          this.listeners["receive-player-list"].add(handler);
        }
        break;
      case ServerEvent.ReceiveSpectatorMessage:
        if (
          isTypedHandler<ServerToClientEvents["receive-spectator-message"]>(
            handler,
          )
        ) {
          this.listeners["receive-spectator-message"].add(handler);
        }
        break;
      case ServerEvent.ReceiveChatMessage:
        if (
          isTypedHandler<ServerToClientEvents["receive-chat-message"]>(handler)
        ) {
          this.listeners["receive-chat-message"].add(handler);
        }
        break;
      case ServerEvent.ReceiveWhisperMessage:
        if (
          isTypedHandler<ServerToClientEvents["receive-whisper-message"]>(
            handler,
          )
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
        if (
          isTypedHandler<ServerToClientEvents["update-player-role"]>(handler)
        ) {
          this.listeners["update-player-role"].add(handler);
        }
        break;
      case ServerEvent.AssignPlayerRole:
        if (
          isTypedHandler<ServerToClientEvents["assign-player-role"]>(handler)
        ) {
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
        if (
          isTypedHandler<ServerToClientEvents["update-player-visit"]>(handler)
        ) {
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
        case ServerEvent.GameSnapshot:
          this.listeners["game-snapshot"].clear();
          break;
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
        case ServerEvent.ReceiveSpectatorMessage:
          this.listeners["receive-spectator-message"].clear();
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
      case ServerEvent.GameSnapshot:
        if (isTypedHandler<ServerToClientEvents["game-snapshot"]>(handler))
          this.listeners["game-snapshot"].delete(handler);
        break;
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
        if (
          isTypedHandler<ServerToClientEvents["receive-new-player"]>(handler)
        ) {
          this.listeners["receive-new-player"].delete(handler);
        }
        break;
      case ServerEvent.RemovePlayer:
        if (isTypedHandler<ServerToClientEvents["remove-player"]>(handler)) {
          this.listeners["remove-player"].delete(handler);
        }
        break;
      case ServerEvent.ReceivePlayerList:
        if (
          isTypedHandler<ServerToClientEvents["receive-player-list"]>(handler)
        ) {
          this.listeners["receive-player-list"].delete(handler);
        }
        break;
      case ServerEvent.ReceiveSpectatorMessage:
        if (
          isTypedHandler<ServerToClientEvents["receive-spectator-message"]>(
            handler,
          )
        ) {
          this.listeners["receive-spectator-message"].delete(handler);
        }
        break;
      case ServerEvent.ReceiveChatMessage:
        if (
          isTypedHandler<ServerToClientEvents["receive-chat-message"]>(handler)
        ) {
          this.listeners["receive-chat-message"].delete(handler);
        }
        break;
      case ServerEvent.ReceiveWhisperMessage:
        if (
          isTypedHandler<ServerToClientEvents["receive-whisper-message"]>(
            handler,
          )
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
        if (
          isTypedHandler<ServerToClientEvents["update-player-role"]>(handler)
        ) {
          this.listeners["update-player-role"].delete(handler);
        }
        break;
      case ServerEvent.AssignPlayerRole:
        if (
          isTypedHandler<ServerToClientEvents["assign-player-role"]>(handler)
        ) {
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
        if (
          isTypedHandler<ServerToClientEvents["update-player-visit"]>(handler)
        ) {
          this.listeners["update-player-visit"].delete(handler);
        }
        break;
    }
  }

  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    if (
      (event === "playerJoinRoom" || event === "spectatorJoinRoom") &&
      (!this.ws || this.ws.readyState !== WebSocket.OPEN)
    )
      return;
    if (
      event !== "playerJoinRoom" &&
      event !== "spectatorJoinRoom" &&
      !this.joinEnvelope
    )
      return;

    let serializableArgs: unknown = args;
    let callbackId: string | undefined;

    const possibleCallback: unknown = args[args.length - 1];
    if (isAckCallback(possibleCallback)) {
      callbackId = `cb_${++this.callbackCounter}`;
      this.pendingCallbacks.set(callbackId, possibleCallback);
      serializableArgs = args.slice(0, -1);
    }

    if (event === "playerJoinRoom" || event === "spectatorJoinRoom") {
      this.joinEnvelope = { event, args: serializableArgs };
      if (isAckCallback(possibleCallback)) this.joinCallback = possibleCallback;
    }
    const envelope = {
      type: PartyServerMessageType.Event,
      event,
      args: serializableArgs,
      ...(callbackId ? { callbackId } : {}),
      ...(event !== "playerJoinRoom" && event !== "spectatorJoinRoom"
        ? { commandId: crypto.randomUUID(), phaseVersion: this.phaseVersion }
        : {}),
    };
    if (envelope.commandId) {
      if (this.pendingCommands.size >= 100) return;
      this.pendingCommands.set(envelope.commandId, { envelope, attempts: 0 });
    }
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify(envelope));
  }

  connect(onOpen?: () => void): void {
    this.stopped = false;
    clearTimeout(this.retryTimer);
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        onOpen?.();
        return;
      }
      if (this.ws.readyState === WebSocket.CONNECTING) {
        if (onOpen) {
          const prev = this.ws.onopen as (() => void) | null;
          const socket = this.ws;
          this.ws.onopen = () => {
            if (this.ws !== socket) return;
            prev?.();
            onOpen();
          };
        }
        return;
      }
    }

    const url = new URL(this.url);
    url.searchParams.set("resume", this.resumeKey);
    this.ws = new WebSocket(url.toString());

    const socket = this.ws;
    this.ws.onopen = () => {
      if (this.ws !== socket) return;
      this._connected = true;
      this.retry = 0;
      clearInterval(this.commandTimer);
      this.commandTimer = setInterval(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) return;
        for (const [id, pending] of this.pendingCommands) {
          if (pending.attempts++ >= 3) {
            this.pendingCommands.delete(id);
            this.dispatchEvent(ServerEvent.ReceiveMessage, [
              { key: MessageKey.ActionNotConfirmed },
            ]);
            console.warn(JSON.stringify({ event: "command.unacknowledged" }));
            continue;
          }
          this.ws.send(JSON.stringify(pending.envelope));
        }
      }, 2000);
      if (!onOpen && this.joinEnvelope) {
        const callbackId = `cb_${++this.callbackCounter}`;
        if (this.joinCallback)
          this.pendingCallbacks.set(callbackId, this.joinCallback);
        this.ws?.send(
          JSON.stringify({
            type: PartyServerMessageType.Event,
            ...this.joinEnvelope,
            callbackId,
          }),
        );
      }
      this._id = `ps_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      onOpen?.();
    };

    this.ws.onmessage = (msgEvent: MessageEvent) => {
      if (this.ws !== socket) return;
      if (typeof msgEvent.data !== "string") return;
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(msgEvent.data);
      } catch {
        return;
      }
      const parsed = partyserverServerEnvelopeSchema.safeParse(parsedData);
      if (!parsed.success) return;

      if (parsed.data.type === PartyServerMessageType.CommandAck) {
        const pending = this.pendingCommands.delete(parsed.data.commandId);
        if (pending && !parsed.data.accepted)
          this.dispatchEvent(ServerEvent.ReceiveMessage, [
            {
              key:
                parsed.data.reason === "stale-phase"
                  ? MessageKey.ActionStale
                  : MessageKey.ActionNotConfirmed,
            },
          ]);
        return;
      }
      if (parsed.data.type === PartyServerMessageType.Callback) {
        const cb = this.pendingCallbacks.get(parsed.data.callbackId);
        const callbackArgs = joinRoomCallbackArgsSchema.safeParse(
          parsed.data.args,
        );
        this.pendingCallbacks.delete(parsed.data.callbackId);
        if (cb && callbackArgs.success) {
          cb(callbackArgs.data[0]);
        }
        return;
      }

      this.dispatchEvent(parsed.data.event, parsed.data.args);
    };

    this.ws.onclose = (event) => {
      if (this.ws !== socket) return;
      this._connected = false;
      clearInterval(this.commandTimer);
      this.pendingCallbacks.clear();
      if (event?.code === 1000 && event.reason === "Room closed")
        this.stopped = true;
      if (!this.stopped)
        this.retryTimer = setTimeout(
          () => this.connect(),
          Math.min(retryDelay(this.retry++), 5000),
        );
    };
  }

  disconnect(): void {
    this.stopped = true;
    clearInterval(this.commandTimer);
    this.pendingCommands.clear();
    clearTimeout(this.retryTimer);
    if (this.ws) {
      this.ws.close(1000, "Client disconnected");
      this.ws = null;
    }
    this._connected = false;
    this.pendingCallbacks.clear();
    this.joinEnvelope = undefined;
    this.joinCallback = undefined;
  }

  get id(): string | undefined {
    return this._id;
  }

  get connected(): boolean {
    return this._connected;
  }

  /**
   * Dispatches a received event to all registered handlers.
   * Performs type validation and transformation of message data.
   *
   * @param event - Event name
   * @param args - Event arguments to dispatch
   */
  private dispatchEvent(event: string, args: unknown[]): void {
    switch (event) {
      case ServerEvent.GameSnapshot: {
        const parsed = gameSnapshotSchema.safeParse(args[0]);
        if (parsed.success) this.phaseVersion = parsed.data.phaseVersion ?? 0;
        if (parsed.success)
          for (const handler of this.listeners["game-snapshot"])
            handler(parsed.data);
        break;
      }
      case ServerEvent.ReceiveMessage: {
        const parsed = gameMessagePayloadSchema.safeParse(args[0]);
        if (parsed.success) {
          for (const handler of this.listeners.receiveMessage) {
            handler(parsed.data);
          }
        }
        break;
      }
      case ServerEvent.ReceiveSpectatorMessage:
      case ServerEvent.ReceiveChatMessage:
      case ServerEvent.ReceiveWhisperMessage:
      case ServerEvent.ReceiveRole: {
        const [msg] = args;
        if (typeof msg === "string") {
          for (const handler of this.listeners[event]) {
            handler(msg);
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
          this.phaseVersion = parsed.data.phaseVersion ?? this.phaseVersion;
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
