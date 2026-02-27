/**
 * PartyKit implementation of the GameSocket interface.
 * Wraps a PartySocket (WebSocket) and translates between the event-based API
 * (used by the game UI) and PartyKit's JSON message protocol.
 *
 * Protocol:
 *   Client → Server: { type: "event", event: string, args: any[], callbackId?: string }
 *   Server → Client: { type: "event", event: string, args: any[] }
 *                   | { type: "callback", callbackId: string, args: any[] }
 */
import type { GameSocket } from "./clientTypes";

type ServerMessage =
  | { type: "event"; event: string; args: unknown[] }
  | { type: "callback"; callbackId: string; args: unknown[] };

export class PartykitClientAdapter implements GameSocket {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private pendingCallbacks = new Map<string, (...args: unknown[]) => void>();
  private callbackCounter = 0;
  private url: string;
  private _id: string | undefined;
  private _connected = false;
  private autoConnect: boolean;

  constructor(url: string, autoConnect = true) {
    this.url = url;
    this.autoConnect = autoConnect;
    if (autoConnect) {
      this.connect();
    }
  }

  on(event: string, handler: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler?: (...args: unknown[]) => void): void {
    if (!handler) {
      this.listeners.delete(event);
      return;
    }
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(event: string, ...args: unknown[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Check if the last argument is a callback function
    const lastArg = args[args.length - 1];
    let callbackId: string | undefined;

    if (typeof lastArg === "function") {
      callbackId = `cb_${++this.callbackCounter}`;
      this.pendingCallbacks.set(callbackId, lastArg as (...a: unknown[]) => void);
      args = args.slice(0, -1);
    }

    const message = JSON.stringify({
      type: "event",
      event,
      args,
      ...(callbackId ? { callbackId } : {}),
    });

    this.ws.send(message);
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this._connected = true;
      this._id = `pk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.dispatch("connect");
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data as string) as ServerMessage;

        if (parsed.type === "event") {
          this.dispatch(parsed.event, ...parsed.args);
        } else if (parsed.type === "callback") {
          const cb = this.pendingCallbacks.get(parsed.callbackId);
          if (cb) {
            cb(...parsed.args);
            this.pendingCallbacks.delete(parsed.callbackId);
          }
        }
      } catch {
        // Non-JSON message, ignore
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.dispatch("disconnect");
    };

    this.ws.onerror = () => {
      this.dispatch("connect_error");
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

  private dispatch(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(...args);
      }
    }
  }
}
