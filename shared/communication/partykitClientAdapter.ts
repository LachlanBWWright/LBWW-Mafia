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

type AckCallback = (result: string | number) => void;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isAckCallback(v: unknown): v is AckCallback {
  return typeof v === "function";
}

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
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
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

    const argsToSend: unknown = args;
    let serializableArgs: unknown = argsToSend;
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

  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this._connected = true;
      this._id = `pk_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;
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

  private dispatchEvent(event: string, args: unknown[]): void {
    switch (event) {
      case "receiveMessage":
      case "receive-chat-message":
      case "receive-whisper-message":
      case "receive-role": {
        const [msg] = args;
        if (typeof msg === "string") {
          this.callHandlers(event, msg);
        }
        break;
      }
      case "blockMessages":
      case "disable-voting":
      case "update-player-visit": {
        this.callHandlers(event);
        break;
      }
      case "receive-new-player":
      case "remove-player": {
        const [player] = args;
        if (isObject(player) && typeof player.name === "string") {
          this.callHandlers(event, { name: player.name });
        }
        break;
      }
      case "receive-player-list": {
        const list = toPlayerList(args[0]);
        if (list) this.callHandlers("receive-player-list", list);
        break;
      }
      case "update-day-time": {
        const [d] = args;
        if (
          isObject(d) &&
          (d.time === "Day" || d.time === "Night") &&
          typeof d.dayNumber === "number" &&
          typeof d.timeLeft === "number"
        ) {
          this.callHandlers("update-day-time", {
            time: d.time,
            dayNumber: d.dayNumber,
            timeLeft: d.timeLeft,
          });
        }
        break;
      }
      case "update-player-role": {
        const [d] = args;
        if (isObject(d) && typeof d.name === "string") {
          this.callHandlers("update-player-role", {
            name: d.name,
            role: typeof d.role === "string" ? d.role : undefined,
          });
        }
        break;
      }
      case "assign-player-role": {
        const data = toPlayerReturned(args[0]);
        if (data) this.callHandlers("assign-player-role", data);
        break;
      }
      case "update-faction-role": {
        const [d] = args;
        if (
          isObject(d) &&
          typeof d.name === "string" &&
          typeof d.role === "string"
        ) {
          this.callHandlers("update-faction-role", {
            name: d.name,
            role: d.role,
          });
        }
        break;
      }
    }
  }
}
