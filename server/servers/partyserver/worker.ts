/// <reference types="@cloudflare/workers-types" />
import {
  Server,
  routePartykitRequest,
  type Connection,
  type ConnectionContext,
} from "partyserver";
import MafiaRoomSession from "./mafiaRoomSession.js";

export interface Env extends Record<string, unknown> {
  Main: DurableObjectNamespace;
  NEXTJS_URL: string;
  BACKEND_SECRET: string;
  DEBUG?: string;
  ROOM_SIZE?: string;
  END_DAY?: string;
}

/** One Durable Object hosts one short-lived Mafia match. */
export class MafiaServer extends Server<Env> {
  static options = { hibernate: false };
  private session?: MafiaRoomSession;

  private getRoom(): MafiaRoomSession {
    return (this.session ??= new MafiaRoomSession({
      id: this.name,
      env: this.env,
      storage: this.ctx.storage,
      broadcast: (message) => this.broadcast(message),
      getConnection: (id) => this.getConnection(id),
      getConnections: () => this.getConnections(),
    }));
  }

  onStart() {
    return this.getRoom().onStart();
  }

  onRequest(request: Request) {
    return this.getRoom().onRequest(request);
  }

  onConnect(connection: Connection, context: ConnectionContext) {
    this.getRoom().onConnect(connection, context);
  }

  onMessage(connection: Connection, message: string | ArrayBuffer) {
    return this.getRoom().onMessage(message, connection);
  }

  onClose(connection: Connection) {
    this.getRoom().onClose(connection);
  }

  onError(connection: Connection, error: unknown) {
    this.getRoom().onError(
      connection,
      error instanceof Error ? error : new Error(String(error)),
    );
  }

  onAlarm() {
    return this.getRoom().onAlarm();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
