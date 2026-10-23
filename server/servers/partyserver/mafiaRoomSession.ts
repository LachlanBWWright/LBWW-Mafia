import { HistoryOutbox, type OutboxStorage } from "../../data/historyOutbox.js";
import {
  CommandLimiter,
  MAX_SOCKET_BYTES,
  MAX_ROOM_CONNECTIONS,
  REQUEST_TIMEOUT_MS,
} from "../../../shared/reliability/limits.js";
import { lobbyConfigSchema } from "@mernmafia/shared/game/lobbyConfig";
import { PartyServerEmitter } from "./partyserverEmitter.js";
import { PartyServerPlayerSocket } from "./partyserverPlayerSocket.js";
import { setGameEmitter } from "../emitter.js";
import { Room } from "../../model/rooms/room.js";
import { ClientEvent } from "../../../shared/communication/events.js";
import { partyserverClientEventEnvelopeSchema } from "../../../shared/communication/protocol.js";
import {
  parseJoinRoomToken,
  parseMessageSentPayload,
  parseVisitPayload,
  parseVotePayload,
  parseWhisperPayload,
} from "../socketValidation.js";
import { verifyPartyServerGameIdentity } from "./partyserverIdentity.js";

const DEFAULT_ROOM_SIZE = 13;

/** Runtime-neutral room session; the Worker adapter owns PartyServer lifecycle hooks. */
export type MafiaConnection = {
  id: string;
  send(message: string): void;
  close(code?: number, reason?: string): void;
};
export type MafiaConnectionContext = { request?: Request };
export type MafiaRoomStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<unknown>;
  put(values: Record<string, unknown>): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  setAlarm(at: number): Promise<unknown>;
};
export type MafiaRoomAdapter = {
  id: string;
  env: Record<string, unknown>;
  storage?: MafiaRoomStorage;
  broadcast(message: string): void;
  getConnection(id: string): MafiaConnection | undefined | null;
  getConnections(): Iterable<MafiaConnection>;
};

/** A short-lived match stays in memory; only configuration and history uploads persist. */
export default class MafiaRoomSession {
  private outbox?: HistoryOutbox;
  private processedCommands = new Map<string, Map<string, number>>();
  private limiter = new CommandLimiter();
  private gameRoom: Room;
  private roomSize: number;
  private playerSockets = new Map<string, PartyServerPlayerSocket>();
  private debugMode: boolean;
  private initialization?: Promise<void>;
  private closed = false;
  private resumeKeys = new Map<string, string>();
  private reservedSeats = new Map<
    string,
    { socketId: string; timer: ReturnType<typeof setTimeout> }
  >();

  private async initializeRoom(): Promise<void> {
    if (!this.initialization)
      this.initialization = this.loadConfig().catch((error: unknown) => {
        this.initialization = undefined;
        throw error;
      });
    await this.initialization;
  }

  private backendContext() {
    return {
      persistHistory: this.outbox
        ? (input: import("../../data/matchHistory.js").MatchHistoryInput) =>
            this.outbox!.enqueue(input)
        : undefined,
      url:
        typeof this.room.env.NEXTJS_URL === "string"
          ? this.room.env.NEXTJS_URL
          : undefined,
      secret:
        typeof this.room.env.BACKEND_SECRET === "string"
          ? this.room.env.BACKEND_SECRET
          : undefined,
    };
  }

  private async loadConfig(): Promise<void> {
    if (await this.room.storage?.get<boolean>("closed")) {
      this.closed = true;
      return;
    }
    const cached = await this.room.storage?.get<unknown>("lobby-config");
    let config = cached;
    if (!config) {
      const base = this.room.env.NEXTJS_URL;
      const secret = this.room.env.BACKEND_SECRET;
      if (typeof base !== "string" || typeof secret !== "string") {
        if (this.debugMode) return;
        throw new Error("NEXTJS_URL and BACKEND_SECRET must be configured");
      }
      const response = await fetch(
        `${base}/api/lobbies/${encodeURIComponent(this.room.id)}`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (response.status === 404) return;
      if (!response.ok)
        throw new Error(`Lobby configuration unavailable: ${response.status}`);
      config = await response.json();
    }
    const parsed = lobbyConfigSchema.safeParse(config);
    if (!parsed.success) throw new Error("Invalid lobby configuration");
    await this.room.storage?.put("lobby-config", parsed.data);
    this.roomSize = parsed.data.size;
    this.gameRoom = new Room(
      this.roomSize,
      this.room.id,
      new PartyServerEmitter(this.room, this.room.id),
      parsed.data,
      this.backendContext(),
    );
  }

  /**
   * Initializes a new Mafia game room for this PartyServer party instance.
   * Sets up the GameEmitter singleton for this instance.
   *
   * @param room - The PartyServer room instance
   */
  constructor(readonly room: MafiaRoomAdapter) {
    this.roomSize =
      Number(room.env.ROOM_SIZE ?? DEFAULT_ROOM_SIZE) || DEFAULT_ROOM_SIZE;
    this.debugMode = String(room.env.DEBUG ?? "").toLowerCase() === "true";

    if (room.storage?.setAlarm) {
      const backend = this.backendContext();
      const storage = room.storage;
      const outboxStorage: OutboxStorage = {
        get: <T>(key: string) => storage.get<T>(key),
        put: (key, value) => storage.put(key, value),
        putBatch: (values) => storage.put(values),
        delete: (key) => storage.delete(key),
        setAlarm: (at) => storage.setAlarm(at),
      };
      this.outbox = new HistoryOutbox(outboxStorage, backend);
    }
    const emitter = new PartyServerEmitter(room, room.id);
    this.gameRoom = new Room(
      this.roomSize,
      room.id,
      emitter,
      undefined,
      this.backendContext(),
    );
    const configuredEndDay = Number(room.env.END_DAY);
    if (Number.isInteger(configuredEndDay) && configuredEndDay > 0) {
      this.gameRoom.endDay = configuredEndDay;
    }

    // Initialize the GameEmitter for this party instance.
    setGameEmitter(emitter);
  }

  async onStart() {
    if (await this.room.storage?.get("pending-history"))
      await this.room.storage.setAlarm(Date.now() + 1000);
  }
  async onAlarm() {
    await this.outbox?.drain();
  }

  /**
   * Handles HTTP requests to the PartyServer server.
   * Supports CORS and returns 404 for non-CORS requests.
   *
   * @param request - The HTTP request
   * @returns HTTP response with CORS headers
   */
  async onRequest(request: Request): Promise<Response> {
    if (
      request.method === "GET" &&
      request.headers.get("authorization") ===
        `Bearer ${this.room.env.BACKEND_SECRET}` &&
      typeof this.room.env.BACKEND_SECRET === "string"
    ) {
      const pending = await this.room.storage?.get<{ attempts: number }>(
        "pending-history",
      );
      return Response.json({
        roomId: this.room.id,
        connections: this.playerSockets.size,
        reservedSeats: this.reservedSeats.size,
        phaseVersion: this.gameRoom.phaseVersion,
        historyPending: Boolean(pending),
        historyAttempts: pending?.attempts ?? 0,
      });
    }
    const origin = request.headers.get("Origin") ?? "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    };
    if (
      request.method === "DELETE" &&
      request.headers.get("authorization") ===
        `Bearer ${this.room.env.BACKEND_SECRET}` &&
      typeof this.room.env.BACKEND_SECRET === "string"
    ) {
      this.closed = true;
      await this.room.storage?.put("closed", true);
      for (const seat of this.reservedSeats.values()) clearTimeout(seat.timer);
      this.reservedSeats.clear();
      for (const connection of this.room.getConnections())
        connection.close(1000, "Room closed");
      return new Response(null, { status: 204 });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }

  /**
   * Handles new player connections to this party instance.
   * Creates a socket adapter for the player and stores it.
   *
   * @param connection - The new player connection
   * @param _ctx - Connection context (unused)
   * @returns
   */
  onConnect(connection: MafiaConnection, _ctx: MafiaConnectionContext) {
    if (this.closed || this.playerSockets.size >= MAX_ROOM_CONNECTIONS) {
      connection.close(1013, "Room unavailable");
      return;
    }
    console.info(
      JSON.stringify({
        event: "connection.open",
        roomId: this.room.id,
        connectionId: connection.id,
      }),
    );
    const playerSocket = new PartyServerPlayerSocket(connection);
    this.playerSockets.set(connection.id, playerSocket);
    const resumeKey = _ctx.request
      ? new URL(_ctx.request.url).searchParams.get("resume")
      : null;
    if (resumeKey && resumeKey.length >= 32 && resumeKey.length <= 256)
      this.resumeKeys.set(connection.id, resumeKey);
  }

  /**
   * Handles incoming messages from players.
   * Routes game events (join, message, vote, visit, whisper) to the game room.
   * Parses JSON messages and validates event types before processing.
   *
   * @param message - Raw message data
   * @param sender - The connection that sent the message
   * @returns
   */
  async onMessage(
    message: string | ArrayBuffer | ArrayBufferView,
    sender: MafiaConnection,
  ) {
    if (!this.limiter.allow(sender.id)) return;
    if (
      (typeof message === "string"
        ? new TextEncoder().encode(message).byteLength
        : message.byteLength) > MAX_SOCKET_BYTES
    ) {
      sender.close(1009, "Payload too large");
      return;
    }
    const raw =
      typeof message === "string" ? message : new TextDecoder().decode(message);

    let parsedUnknown: unknown;
    try {
      parsedUnknown = JSON.parse(raw);
    } catch {
      console.error(
        JSON.stringify({ event: "command.invalid", roomId: this.room.id }),
      );
      return;
    }

    const parsed = partyserverClientEventEnvelopeSchema.safeParse(parsedUnknown);
    if (!parsed.success) return;

    const playerSocket = this.playerSockets.get(sender.id);
    if (!playerSocket) return;

    const command = parsed.data;
    const isAction =
      command.event !== ClientEvent.PlayerJoinRoom &&
      command.event !== ClientEvent.SpectatorJoinRoom;
    const ack = (accepted: boolean, reason?: string) =>
      sender.send(
        JSON.stringify({
          type: "command-ack",
          commandId: command.commandId,
          accepted,
          reason,
        }),
      );
    const validAction =
      command.event === ClientEvent.MessageSentByUser
        ? parseMessageSentPayload(command.args[0], command.args[1])
        : command.event === ClientEvent.HandleVote
          ? parseVotePayload(command.args[0], command.args[1])
          : command.event === ClientEvent.HandleVisit
            ? parseVisitPayload(command.args[0], command.args[1])
            : command.event === ClientEvent.HandleWhisper
              ? parseWhisperPayload(
                  command.args[0],
                  command.args[1],
                  command.args[2],
                )
              : command.event === ClientEvent.ReadyForRematch &&
                  command.args.length === 0
                ? true
                : null;
    if (isAction && !validAction) {
      if (command.commandId) ack(false, "invalid-command");
      return;
    }
    if (isAction && command.commandId) {
      const owner = this.resumeKeys.get(sender.id) ?? sender.id;
      let completed = this.processedCommands.get(owner);
      if (!completed) {
        completed = new Map();
        this.processedCommands.set(owner, completed);
      }
      if (completed.has(command.commandId)) {
        ack(true);
        return;
      }
      if (
        !playerSocket.data.roomObject ||
        command.phaseVersion !== this.gameRoom.phaseVersion
      ) {
        ack(false, "stale-phase");
        this.gameRoom.sendSnapshot(sender.id);
        return;
      }
      if (completed.size >= 128)
        completed.delete(completed.keys().next().value!);
      completed.set(command.commandId, Date.now());
    } else if (isAction && !this.debugMode) {
      ack(false, "version-required");
      return;
    }
    switch (parsed.data.event) {
      case ClientEvent.SpectatorJoinRoom:
      case ClientEvent.PlayerJoinRoom: {
        try {
          await this.initializeRoom();
        } catch (error) {
          console.error("Unable to initialize room", error);
          if (parsed.data.callbackId)
            playerSocket.sendCallback(parsed.data.callbackId, {
              status: "rejected",
              code: 1,
            });
          break;
        }
        if (this.playerSockets.get(sender.id) !== playerSocket) break;
        if (this.closed) {
          if (parsed.data.callbackId)
            playerSocket.sendCallback(parsed.data.callbackId, {
              status: "rejected",
              code: 1,
            });
          break;
        }
        const key = this.resumeKeys.get(sender.id);
        const reserved = key ? this.reservedSeats.get(key) : undefined;
        if (reserved) {
          clearTimeout(reserved.timer);
          this.reservedSeats.delete(key!);
          const result = this.gameRoom.resumeUser(
            reserved.socketId,
            playerSocket,
          );
          if (parsed.data.callbackId)
            playerSocket.sendCallback(parsed.data.callbackId, result);
          if (result.status === "joined") {
            this.gameRoom.sendSnapshot(sender.id);
            console.info(
              JSON.stringify({
                event: "connection.resumed",
                roomId: this.room.id,
              }),
            );
          }
          break;
        }

        const captchaToken = parseJoinRoomToken(parsed.data.args[0]);
        if (captchaToken === null) {
          break;
        }
        const identityToken =
          typeof parsed.data.args[1] === "string"
            ? parsed.data.args[1]
            : undefined;
        const identity = await verifyPartyServerGameIdentity(
          identityToken,
          this.room.env.BACKEND_SECRET,
        );
        // Authentication may yield while the socket closes or the room is deleted.
        if (this.closed || this.playerSockets.get(sender.id) !== playerSocket)
          break;
        playerSocket.data.roomObject = this.gameRoom;
        const result =
          parsed.data.event === ClientEvent.SpectatorJoinRoom
            ? this.gameRoom.addSpectator(playerSocket, identity)
            : this.gameRoom.addUser(playerSocket, identity);

        if (parsed.data.callbackId) {
          playerSocket.sendCallback(parsed.data.callbackId, result);
        }
        if (result.status === "joined") this.gameRoom.sendSnapshot(sender.id);
        break;
      }

      case ClientEvent.MessageSentByUser: {
        const payload = parseMessageSentPayload(
          parsed.data.args[0],
          parsed.data.args[1],
        );
        if (!payload || playerSocket.data.roomObject === undefined) {
          break;
        }
        playerSocket.data.roomObject.handleSentMessage(
          playerSocket,
          payload.message,
          payload.phase,
        );
        break;
      }

      case ClientEvent.ReadyForRematch:
        playerSocket.data.roomObject?.readyForRematch(playerSocket);
        break;
      case ClientEvent.HandleVote: {
        const payload = parseVotePayload(
          parsed.data.args[0],
          parsed.data.args[1],
        );
        if (!payload || playerSocket.data.roomObject === undefined) {
          break;
        }
        playerSocket.data.roomObject.handleVote(
          playerSocket,
          payload.recipient,
          payload.phase,
        );
        break;
      }

      case ClientEvent.HandleVisit: {
        const payload = parseVisitPayload(
          parsed.data.args[0],
          parsed.data.args[1],
        );
        if (!payload || playerSocket.data.roomObject === undefined) {
          break;
        }
        playerSocket.data.roomObject.handleVisit(
          playerSocket,
          payload.recipient,
          payload.phase,
        );
        break;
      }

      case ClientEvent.HandleWhisper: {
        const payload = parseWhisperPayload(
          parsed.data.args[0],
          parsed.data.args[1],
          parsed.data.args[2],
        );
        if (!payload || playerSocket.data.roomObject === undefined) {
          break;
        }
        playerSocket.data.roomObject.handleWhisper(
          playerSocket,
          payload.recipient,
          payload.message,
          payload.phase,
        );
        break;
      }
    }
    if (isAction && command.commandId) ack(true);
  }

  /** Handles disconnections and reserves seats for reconnection. */
  onClose(connection: MafiaConnection) {
    console.log(`PartyServer: Connection closed ${connection.id}`);
    const playerSocket = this.playerSockets.get(connection.id);
    const room = playerSocket?.data.roomObject;
    if (room) {
      room.setConnected(connection.id, false);
      const key = this.resumeKeys.get(connection.id);
      if (key && !this.closed) {
        const timer = setTimeout(() => {
          this.reservedSeats.delete(key);
          this.processedCommands.delete(key);
          room.removePlayer(connection.id);
        }, 30_000);
        this.reservedSeats.set(key, { socketId: connection.id, timer });
      } else room.removePlayer(connection.id);
    }
    this.limiter.remove(connection.id);
    const closedOwner = this.resumeKeys.get(connection.id) ?? connection.id;
    if (!this.reservedSeats.has(closedOwner))
      this.processedCommands.delete(closedOwner);
    this.playerSockets.delete(connection.id);
    this.resumeKeys.delete(connection.id);
  }

  /**
   * Handles connection errors by closing the connection and cleaning up.
   *
   * @param connection - The connection that encountered an error
   * @param error - The error that occurred
   * @returns
   */
  onError(connection: MafiaConnection, error: Error) {
    console.error(`PartyServer: Connection error ${connection.id}:`, error);
    this.onClose(connection);
  }
}
