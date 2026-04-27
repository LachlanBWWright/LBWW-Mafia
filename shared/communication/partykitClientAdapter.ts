/**
 * PartyKit implementation of the GameSocket interface.
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
  PlayerList,
  PlayerReturned,
} from "./events";
import { ServerEvent, DayTime } from "./events";

type AckCallback = (result: string | number) => void;

/**
 * Type guard to check if a value is an object (excluding arrays and null).
 *
 * @param {unknown} v - Value to check
 * @returns {boolean} True if v is a non-null, non-array object
 */
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Type guard to check if a value is an acknowledgement callback function.
 *
 * @param {unknown} v - Value to check
 * @returns {boolean} True if v is a callback function
 */
function isAckCallback(v: unknown): v is AckCallback {
  return typeof v === "function";
}

/**
 * Converts raw message data to a typed PlayerList array.
 * Returns undefined if the data is not a valid PlayerList.
 *
 * @param {unknown} raw - Raw data to convert
 * @returns {PlayerList[] | undefined} Typed player list or undefined
 */
function toPlayerList(raw: unknown): PlayerList[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const result: PlayerList[] = [];
  for (const item of raw) {
    if (isObject(item) && typeof item.name === "string") {
      result.push({
        name: item.name,
        isAlive:
          typeof item.isAlive === "boolean" ? item.isAlive : undefined,
        role: typeof item.role === "string" ? item.role : "",
      });
    }
  }
  return result;
}

/**
 * Converts raw message data to a typed PlayerReturned object.
 * Returns undefined if the data is not a valid PlayerReturned.
 *
 * @param {unknown} raw - Raw data to convert
 * @returns {PlayerReturned | undefined} Typed player data or undefined
 */
function toPlayerReturned(raw: unknown): PlayerReturned | undefined {
  if (!isObject(raw)) return undefined;
  if (
    typeof raw.name !== "string" ||
    typeof raw.role !== "string" ||
    typeof raw.dayVisitSelf !== "boolean" ||
    typeof raw.dayVisitOthers !== "boolean" ||
    typeof raw.dayVisitFaction !== "boolean" ||
    typeof raw.nightVisitSelf !== "boolean" ||
    typeof raw.nightVisitOthers !== "boolean" ||
    typeof raw.nightVisitFaction !== "boolean" ||
    typeof raw.nightVote !== "boolean"
  ) {
    return undefined;
  }
  return {
    name: raw.name,
    role: raw.role,
    dayVisitSelf: raw.dayVisitSelf,
    dayVisitOthers: raw.dayVisitOthers,
    dayVisitFaction: raw.dayVisitFaction,
    nightVisitSelf: raw.nightVisitSelf,
    nightVisitOthers: raw.nightVisitOthers,
    nightVisitFaction: raw.nightVisitFaction,
    nightVote: raw.nightVote,
  };
}

/**
 * PartyKit WebSocket adapter implementing the GameSocket interface.
 * Manages event listeners, callback tracking, and message serialization.
 */
export class PartykitClientAdapter implements GameSocket {
  private ws: WebSocket | null = null;
  // Internal storage uses unknown element type; the public on/off methods
  // enforce type constraints at insertion and removal time.
  private listeners = new Map<
    keyof ServerToClientEvents,
    Set<ServerToClientEvents[keyof ServerToClientEvents]>
  >();
  private pendingCallbacks = new Map<string, AckCallback>();
  private callbackCounter = 0;
  private readonly url: string;
  private _id: string | undefined;
  private _connected = false;

  constructor(url: string, autoConnect = true) {
    this.url = url;
    if (autoConnect) {
      this.connect();
    }
  }

  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K],
  ): void {
    let listeners = this.listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(event, listeners);
    }
    listeners.add(handler);
  }

  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler?: ServerToClientEvents[K],
  ): void {
    if (!handler) {
      this.listeners.delete(event);
      return;
    }
    this.listeners.get(event)?.delete(handler);
  }

  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    let serializableArgs: unknown = args;
    let callbackId: string | undefined;

    const possibleCallback: unknown = args[args.length - 1];
    if (isAckCallback(possibleCallback)) {
      callbackId = `cb_${++this.callbackCounter}`;
      this.pendingCallbacks.set(callbackId, possibleCallback);
      serializableArgs = args.slice(0, -1);
    }

    this.ws.send(
      JSON.stringify({
        type: "event",
        event,
        args: serializableArgs,
        ...(callbackId ? { callbackId } : {}),
      }),
    );
  }

  connect(onOpen?: () => void): void {
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        onOpen?.();
        return;
      }
      if (this.ws.readyState === WebSocket.CONNECTING) {
        if (onOpen) {
          const prev = this.ws.onopen as (() => void) | null;
          this.ws.onopen = () => { prev?.(); onOpen(); };
        }
        return;
      }
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this._connected = true;
      this._id = `pk_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      onOpen?.();
    };

    this.ws.onmessage = (msgEvent: MessageEvent) => {
      if (typeof msgEvent.data !== "string") return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(msgEvent.data);
      } catch {
        return;
      }
      if (!isObject(parsed) || typeof parsed.type !== "string") return;

      if (
        parsed.type === "callback" &&
        typeof parsed.callbackId === "string" &&
        Array.isArray(parsed.args)
      ) {
        const cb = this.pendingCallbacks.get(parsed.callbackId);
        const result = parsed.args[0];
        if (cb && (typeof result === "string" || typeof result === "number")) {
          cb(result);
          this.pendingCallbacks.delete(parsed.callbackId);
        }
        return;
      }

      if (
        parsed.type === "event" &&
        typeof parsed.event === "string" &&
        Array.isArray(parsed.args)
      ) {
        this.dispatchEvent(parsed.event, parsed.args);
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
    this.pendingCallbacks.clear();
  }

  get id(): string | undefined {
    return this._id;
  }

  get connected(): boolean {
    return this._connected;
  }

  private callHandlers<K extends keyof ServerToClientEvents>(
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    // Reflect.apply avoids the TypeScript limitation of spreading generic Parameters<T>
    // while keeping the public API fully typed.
    handlers.forEach((handler) => {
      Reflect.apply(handler as CallableFunction, undefined, args);
    });
  }

  /**
   * Dispatches a received event to all registered handlers.
   * Performs type validation and transformation of message data.
   *
   * @param {string} event - Event name
   * @param {unknown[]} args - Event arguments to dispatch
   */
  private dispatchEvent(event: string, args: unknown[]): void {
    switch (event) {
      case ServerEvent.ReceiveMessage:
      case ServerEvent.ReceiveChatMessage:
      case ServerEvent.ReceiveWhisperMessage:
      case ServerEvent.ReceiveRole: {
        const [msg] = args;
        if (typeof msg === "string") {
          this.callHandlers(event, msg);
        }
        break;
      }
      case ServerEvent.BlockMessages:
      case ServerEvent.DisableVoting:
      case ServerEvent.UpdatePlayerVisit: {
        this.callHandlers(event);
        break;
      }
      case ServerEvent.ReceiveNewPlayer:
      case ServerEvent.RemovePlayer: {
        const [player] = args;
        if (isObject(player) && typeof player.name === "string") {
          this.callHandlers(event, { name: player.name });
        }
        break;
      }
      case ServerEvent.ReceivePlayerList: {
        const list = toPlayerList(args[0]);
        if (list) this.callHandlers(ServerEvent.ReceivePlayerList, list);
        break;
      }
      case ServerEvent.UpdateDayTime: {
        const [d] = args;
        if (
          isObject(d) &&
          (d.time === DayTime.Day || d.time === DayTime.Night) &&
          typeof d.dayNumber === "number" &&
          typeof d.timeLeft === "number"
        ) {
          this.callHandlers(ServerEvent.UpdateDayTime, {
            time: d.time,
            dayNumber: d.dayNumber,
            timeLeft: d.timeLeft,
          });
        }
        break;
      }
      case ServerEvent.UpdatePlayerRole: {
        const [d] = args;
        if (isObject(d) && typeof d.name === "string") {
          this.callHandlers(ServerEvent.UpdatePlayerRole, {
            name: d.name,
            role: typeof d.role === "string" ? d.role : undefined,
          });
        }
        break;
      }
      case ServerEvent.AssignPlayerRole: {
        const data = toPlayerReturned(args[0]);
        if (data) this.callHandlers(ServerEvent.AssignPlayerRole, data);
        break;
      }
      case ServerEvent.UpdateFactionRole: {
        const [d] = args;
        if (
          isObject(d) &&
          typeof d.name === "string" &&
          typeof d.role === "string"
        ) {
          this.callHandlers(ServerEvent.UpdateFactionRole, {
            name: d.name,
            role: d.role,
          });
        }
        break;
      }
    }
  }
}
