import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ClientEvent,
  PartyKitMessageType,
} from "../../../shared/communication/events.js";
import MafiaPartyServer from "./partykitServer.js";

type SentMessage = {
  type: string;
  event?: string;
  callbackId?: string;
  args: unknown[];
};

function createPartyRoom(debug = true, roomId = "test-room") {
  const sentByConnection = new Map<string, string[]>();
  const connections = new Map<
    string,
    { id: string; send(message: string): void; close(): void }
  >();
  const room = {
    id: roomId,
    name: "main",
    storage: debug
      ? undefined
      : {
          get: async (key: string) =>
            key === "lobby-config"
              ? {
                  size: 3,
                  roleSelection: {
                    algorithm: "weighted-random",
                    roles: [{ role: "doctor" }],
                    explicitSlots: [],
                  },
                }
              : undefined,
          put: async () => undefined,
        },
    env: {
      DEBUG: debug ? "true" : "false",
      ROOM_SIZE: "3",
      CAPTCHA_KEY: undefined as string | undefined,
    },
    broadcast(message: string) {
      for (const connection of connections.values()) connection.send(message);
    },
    getConnection(id: string) {
      return connections.get(id);
    },
    getConnections() {
      return connections.values();
    },
  };

  function addConnection(id: string) {
    const messages: string[] = [];
    const connection = {
      id,
      send(message: string) {
        messages.push(message);
      },
      close() {
        // The PartyKit runtime closes the connection; the test only needs the API shape.
      },
    };
    connections.set(id, connection);
    sentByConnection.set(id, messages);
    return connection;
  }

  return { room, addConnection, sentByConnection };
}

function parseMessages(messages: string[]): SentMessage[] {
  return messages.map((message) => JSON.parse(message) as SentMessage);
}

describe("MafiaPartyServer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("handles CORS preflight and rejects unrelated HTTP requests", async () => {
    const { room } = createPartyRoom();
    const server = new MafiaPartyServer(room as never);

    const preflight = await server.onRequest(
      new Request("https://example.test/parties/main/test-room", {
        method: "OPTIONS",
        headers: { Origin: "https://game.example" },
      }) as never,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://game.example",
    );

    const missing = await server.onRequest(
      new Request("https://example.test/parties/main/test-room") as never,
    );
    expect(missing.status).toBe(404);
  });

  it("routes a valid join through the Room and returns its callback", async () => {
    const { room, addConnection, sentByConnection } = createPartyRoom();
    const connection = addConnection("connection-1");
    const server = new MafiaPartyServer(room as never);
    server.onConnect(connection as never, {} as never);

    await server.onMessage(
      JSON.stringify({
        type: PartyKitMessageType.Event,
        event: ClientEvent.PlayerJoinRoom,
        args: ["dev-bypass-token"],
        callbackId: "join-1",
      }),
      connection as never,
    );

    const messages = parseMessages(sentByConnection.get("connection-1") ?? []);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: PartyKitMessageType.Callback,
          callbackId: "join-1",
          args: [{ status: "joined", username: expect.any(String) }],
        }),
        expect.objectContaining({
          type: PartyKitMessageType.Event,
          event: "receive-player-list",
        }),
      ]),
    );
  });

  it("keeps concurrent PartyKit rooms isolated", async () => {
    const first = createPartyRoom(true, "room-a");
    const second = createPartyRoom(true, "room-b");
    const firstConnection = first.addConnection("connection-a");
    const secondConnection = second.addConnection("connection-b");
    const firstServer = new MafiaPartyServer(first.room as never);
    firstServer.onConnect(firstConnection as never, {} as never);
    // Constructing another PartyKit room changes the legacy global emitter.
    new MafiaPartyServer(second.room as never).onConnect(
      secondConnection as never,
      {} as never,
    );

    await firstServer.onMessage(
      JSON.stringify({
        type: PartyKitMessageType.Event,
        event: ClientEvent.PlayerJoinRoom,
        args: ["dev-bypass-token"],
        callbackId: "join-a",
      }),
      firstConnection as never,
    );

    expect(first.sentByConnection.get("connection-a")).toEqual(
      expect.arrayContaining([
        expect.stringContaining('"callbackId":"join-a"'),
      ]),
    );
    expect(second.sentByConnection.get("connection-b")).toEqual([]);
  });

  it("keeps scheduled phase messages on their original room emitter", async () => {
    vi.useFakeTimers();
    const first = createPartyRoom(true, "phase-room-a");
    const firstServer = new MafiaPartyServer(first.room as never);
    for (const id of ["a", "b", "c"]) {
      const connection = first.addConnection(id);
      firstServer.onConnect(connection as never, {} as never);
      await firstServer.onMessage(
        JSON.stringify({
          type: "event",
          event: "playerJoinRoom",
          args: ["dev-bypass-token"],
          callbackId: id,
        }),
        connection as never,
      );
    }
    const second = createPartyRoom(true, "phase-room-b");
    const other = second.addConnection("other");
    new MafiaPartyServer(second.room as never).onConnect(
      other as never,
      {} as never,
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(parseMessages(first.sentByConnection.get("a")!)).toContainEqual(
      expect.objectContaining({
        event: "receiveMessage",
        args: [{ key: "night_1_started" }],
      }),
    );
    expect(second.sentByConnection.get("other")).toEqual([]);
    vi.useRealTimers();
  });

  it("ignores malformed or unauthenticated messages at the socket boundary", async () => {
    const { room, addConnection, sentByConnection } = createPartyRoom(false);
    const connection = addConnection("connection-1");
    const server = new MafiaPartyServer(room as never);
    server.onConnect(connection as never, {} as never);

    await server.onMessage("not-json", connection as never);
    await server.onMessage(
      JSON.stringify({
        type: PartyKitMessageType.Event,
        event: ClientEvent.PlayerJoinRoom,
        args: ["invalid-token"],
        callbackId: "join-2",
      }),
      connection as never,
    );

    const messages = parseMessages(sentByConnection.get("connection-1") ?? []);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      type: PartyKitMessageType.Callback,
      callbackId: "join-2",
      args: [{ status: "rejected", code: 2 }],
    });
  });

  it("verifies CAPTCHA before accepting a production join", async () => {
    const { room, addConnection, sentByConnection } = createPartyRoom(false);
    room.env.CAPTCHA_KEY = "captcha-secret";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true }),
      })),
    );
    const connection = addConnection("connection-1");
    const server = new MafiaPartyServer(room as never);
    server.onConnect(connection as never, {} as never);

    await server.onMessage(
      JSON.stringify({
        type: PartyKitMessageType.Event,
        event: ClientEvent.PlayerJoinRoom,
        args: ["captcha-token"],
        callbackId: "join-3",
      }),
      connection as never,
    );

    expect(parseMessages(sentByConnection.get("connection-1") ?? [])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: PartyKitMessageType.Callback,
          callbackId: "join-3",
          args: [{ status: "joined", username: expect.any(String) }],
        }),
      ]),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("siteverify?response=captcha-token"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

describe("versioned commands", () => {
  it("applies a duplicate command once and rejects an obsolete phase version", async () => {
    const { room, addConnection, sentByConnection } = createPartyRoom();
    const connection = addConnection("commands");
    const server = new MafiaPartyServer(room as never);
    server.onConnect(connection as never, {} as never);
    await server.onMessage(
      JSON.stringify({
        type: "event",
        event: "playerJoinRoom",
        args: ["dev-bypass-token"],
        callbackId: "join",
      }),
      connection as never,
    );
    const send = (commandId: string, phaseVersion: number) =>
      server.onMessage(
        JSON.stringify({
          type: "event",
          event: "messageSentByUser",
          args: ["exactly-once", "Day"],
          commandId,
          phaseVersion,
        }),
        connection as never,
      );
    await send("once", 0);
    await send("once", 0);
    const messages = parseMessages(sentByConnection.get("commands")!);
    expect(
      messages.filter((message) => message.event === "receive-chat-message"),
    ).toHaveLength(1);
    await send("stale", 999);
    expect(
      sentByConnection.get("commands")!.map((message) => JSON.parse(message)),
    ).toContainEqual(
      expect.objectContaining({
        type: "command-ack",
        commandId: "stale",
        accepted: false,
        reason: "stale-phase",
      }),
    );
  });
});

describe("configured lobbies and recovery", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("loads validated persisted rules and assigns exactly the configured roster", async () => {
    vi.useFakeTimers();
    const { room, addConnection, sentByConnection } = createPartyRoom();
    Object.assign(room.env, {
      NEXTJS_URL: "https://web.test",
      BACKEND_SECRET: "secret",
    });
    const config = {
      size: 2,
      roleSelection: {
        algorithm: "explicit-slots",
        roles: [],
        explicitSlots: ["doctor", "mafia"],
      },
    };
    const fetchConfig = vi.fn(async () => Response.json(config));
    vi.stubGlobal("fetch", fetchConfig);
    const server = new MafiaPartyServer(room as never);
    for (const id of ["a", "b"]) {
      const connection = addConnection(id);
      server.onConnect(connection as never, {} as never);
      await server.onMessage(
        JSON.stringify({
          type: "event",
          event: "playerJoinRoom",
          args: ["dev-bypass-token"],
          callbackId: id,
        }),
        connection as never,
      );
    }
    expect(fetchConfig).toHaveBeenCalledOnce();
    const assigned = [...sentByConnection.values()]
      .flatMap(parseMessages)
      .filter((message) => message.event === "assign-player-role");
    expect(
      assigned
        .map((message) => (message.args[0] as { role: string }).role)
        .sort(),
    ).toEqual(["Doctor", "Mafia"]);
    for (const id of ["a", "b"]) {
      const snapshots = parseMessages(sentByConnection.get(id)!).filter(
        (message) => message.event === "game-snapshot",
      );
      const snapshot = snapshots.at(-1)!.args[0] as {
        playerName: string;
        players: { name: string; isAlive: boolean; role?: string }[];
      };
      expect(snapshot.players).toHaveLength(2);
      expect(snapshot.players.every((player) => player.isAlive)).toBe(true);
      expect(
        snapshot.players.find((player) => player.name === snapshot.playerName)
          ?.role,
      ).toBeDefined();
      expect(
        snapshot.players.find((player) => player.name !== snapshot.playerName)
          ?.role,
      ).toBeUndefined();
    }
    const extra = addConnection("c");
    server.onConnect(extra as never, {} as never);
    await server.onMessage(
      JSON.stringify({
        type: "event",
        event: "playerJoinRoom",
        args: ["dev-bypass-token"],
        callbackId: "c",
      }),
      extra as never,
    );
    expect(parseMessages(sentByConnection.get("c")!)).toContainEqual(
      expect.objectContaining({ args: [{ status: "rejected", code: 3 }] }),
    );
  });
  it("fails closed when the configuration service is unavailable", async () => {
    const { room, addConnection, sentByConnection } = createPartyRoom();
    Object.assign(room.env, {
      NEXTJS_URL: "https://web.test",
      BACKEND_SECRET: "secret",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );
    const server = new MafiaPartyServer(room as never);
    const connection = addConnection("a");
    server.onConnect(connection as never, {} as never);
    await server.onMessage(
      JSON.stringify({
        type: "event",
        event: "playerJoinRoom",
        args: ["dev-bypass-token"],
        callbackId: "a",
      }),
      connection as never,
    );
    expect(parseMessages(sentByConnection.get("a")!)).toContainEqual(
      expect.objectContaining({ args: [{ status: "rejected", code: 1 }] }),
    );
  });
  it("reserves a seat for 30 seconds and restores the same player on a new connection", async () => {
    vi.useFakeTimers();
    const { room, addConnection, sentByConnection } = createPartyRoom();
    const server = new MafiaPartyServer(room as never);
    const key = "a-secret-resume-key-with-at-least-32-characters";
    const context = {
      request: new Request(`https://party.test?resume=${key}`),
    };
    const first = addConnection("first");
    server.onConnect(first as never, context as never);
    const join = (id: string) =>
      JSON.stringify({
        type: "event",
        event: "playerJoinRoom",
        args: ["dev-bypass-token"],
        callbackId: id,
      });
    await server.onMessage(join("first"), first as never);
    const previous = parseMessages(sentByConnection.get("first")!).find(
      (message) => message.type === "callback",
    )!.args[0];
    server.onClose(first as never);
    await vi.advanceTimersByTimeAsync(5000);
    const second = addConnection("second");
    server.onConnect(second as never, context as never);
    await server.onMessage(join("second"), second as never);
    const returned = parseMessages(sentByConnection.get("second")!);
    expect(
      returned.find((message) => message.type === "callback")!.args[0],
    ).toEqual(previous);
    expect(
      returned.find((message) => message.event === "game-snapshot"),
    ).toBeDefined();
    expect(
      returned.filter((message) => message.event === "receive-new-player"),
    ).toHaveLength(0);
    server.onClose(second as never);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(
      parseMessages(sentByConnection.get("second")!).some(
        (message) => message.event === "remove-player",
      ),
    ).toBe(true);
  });
});
