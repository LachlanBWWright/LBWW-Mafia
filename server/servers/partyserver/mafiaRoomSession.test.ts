import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ClientEvent,
  PartyServerMessageType,
} from "../../../shared/communication/events.js";
import MafiaRoomSession from "./mafiaRoomSession.js";

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
        // The PartyServer runtime closes the connection; the test only needs the API shape.
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

describe("MafiaRoomSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("handles CORS preflight and rejects unrelated HTTP requests", async () => {
    const { room } = createPartyRoom();
    const server = new MafiaRoomSession(room as never);

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
    const server = new MafiaRoomSession(room as never);
    server.onConnect(connection as never, {} as never);

    await server.onMessage(
      JSON.stringify({
        type: PartyServerMessageType.Event,
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
          type: PartyServerMessageType.Callback,
          callbackId: "join-1",
          args: [{ status: "joined", username: expect.any(String) }],
        }),
        expect.objectContaining({
          type: PartyServerMessageType.Event,
          event: "receive-player-list",
        }),
      ]),
    );
  });

  it("keeps concurrent PartyServer rooms isolated", async () => {
    const first = createPartyRoom(true, "room-a");
    const second = createPartyRoom(true, "room-b");
    const firstConnection = first.addConnection("connection-a");
    const secondConnection = second.addConnection("connection-b");
    const firstServer = new MafiaRoomSession(first.room as never);
    firstServer.onConnect(firstConnection as never, {} as never);
    // Constructing another PartyServer room changes the legacy global emitter.
    new MafiaRoomSession(second.room as never).onConnect(
      secondConnection as never,
      {} as never,
    );

    await firstServer.onMessage(
      JSON.stringify({
        type: PartyServerMessageType.Event,
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
    const firstServer = new MafiaRoomSession(first.room as never);
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
    new MafiaRoomSession(second.room as never).onConnect(
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

  it("ignores malformed messages at the socket boundary", async () => {
    const { room, addConnection, sentByConnection } = createPartyRoom(false);
    const connection = addConnection("connection-1");
    const server = new MafiaRoomSession(room as never);
    server.onConnect(connection as never, {} as never);

    await server.onMessage("not-json", connection as never);
    await server.onMessage(
      JSON.stringify({
        type: PartyServerMessageType.Event,
        event: ClientEvent.PlayerJoinRoom,
        args: [123],
        callbackId: "join-2",
      }),
      connection as never,
    );

    const messages = parseMessages(sentByConnection.get("connection-1") ?? []);
    expect(messages).toEqual([]);
  });

  it.each([ClientEvent.PlayerJoinRoom, ClientEvent.SpectatorJoinRoom])(
    "accepts a production %s without CAPTCHA credentials or verification",
    async (joinEvent) => {
      const { room, addConnection, sentByConnection } = createPartyRoom(false);
      vi.stubGlobal("fetch", vi.fn());
      const connection = addConnection("connection-1");
      const server = new MafiaRoomSession(room as never);
      server.onConnect(connection as never, {} as never);

      await server.onMessage(
        JSON.stringify({
          type: PartyServerMessageType.Event,
          event: joinEvent,
          args: [""],
          callbackId: "join-3",
        }),
        connection as never,
      );

      expect(parseMessages(sentByConnection.get("connection-1") ?? [])).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: PartyServerMessageType.Callback,
            callbackId: "join-3",
            args: [{ status: "joined", username: expect.any(String) }],
          }),
        ]),
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );
});

describe("versioned commands", () => {
  it("applies a duplicate command once and rejects an obsolete phase version", async () => {
    const { room, addConnection, sentByConnection } = createPartyRoom();
    const connection = addConnection("commands");
    const server = new MafiaRoomSession(room as never);
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

describe("configured lobbies and connection reservations", () => {
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
    const server = new MafiaRoomSession(room as never);
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
    const server = new MafiaRoomSession(room as never);
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
    const server = new MafiaRoomSession(room as never);
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

describe("room session boundary regressions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not allocate a seat after a connection closes while configuration loads", async () => {
    const harness = createPartyRoom();
    Object.assign(harness.room.env, {
      NEXTJS_URL: "https://web.test",
      BACKEND_SECRET: "secret",
    });
    let resolveConfig!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      resolveConfig = resolve;
    })));
    const server = new MafiaRoomSession(harness.room as never);
    const departed = harness.addConnection("departed");
    server.onConnect(departed, {});
    const joining = server.onMessage(JSON.stringify({
      type: "event",
      event: "playerJoinRoom",
      args: [""],
      callbackId: "departed-join",
    }), departed);
    server.onClose(departed);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    resolveConfig(Response.json({
      size: 3,
      roleSelection: { algorithm: "weighted-random", roles: [{ role: "doctor" }], explicitSlots: [] },
    }));
    await joining;
    expect(harness.sentByConnection.get("departed")).toEqual([]);

    const present = harness.addConnection("present");
    server.onConnect(present, {});
    await server.onMessage(JSON.stringify({
      type: "event", event: "playerJoinRoom", args: [""], callbackId: "present-join",
    }), present);
    const snapshots = parseMessages(harness.sentByConnection.get("present")!)
      .filter((message) => message.event === "game-snapshot");
    expect(snapshots.at(-1)?.args[0]).toEqual(expect.objectContaining({
      players: [expect.objectContaining({ name: expect.any(String) })],
    }));
  });

  it("does not allocate a seat after disconnect during signed identity verification", async () => {
    const harness = createPartyRoom(false);
    Object.assign(harness.room.env, { BACKEND_SECRET: "secret" });
    const server = new MafiaRoomSession(harness.room as never);
    const connection = harness.addConnection("identity-pending");
    server.onConnect(connection, {});
    const payload = Buffer.from(JSON.stringify({ userId: "user-1", exp: Date.now() + 60_000 })).toString("base64url");
    const signature = createHmac("sha256", "secret").update(payload).digest("base64url");
    let resolveVerification!: (valid: boolean) => void;
    const verify = vi.spyOn(crypto.subtle, "verify").mockImplementation(() => new Promise<boolean>((resolve) => {
      resolveVerification = resolve;
    }));
    const joining = server.onMessage(JSON.stringify({
      type: "event", event: "playerJoinRoom", args: ["", `${payload}.${signature}`], callbackId: "identity-join",
    }), connection);
    await vi.waitFor(() => expect(verify).toHaveBeenCalledOnce());
    server.onClose(connection);
    resolveVerification(true);
    await joining;
    expect(harness.sentByConnection.get(connection.id)).toEqual([]);
  });

  it("shares one initialization request across simultaneous joins", async () => {
    const harness = createPartyRoom();
    Object.assign(harness.room.env, { NEXTJS_URL: "https://web.test", BACKEND_SECRET: "secret" });
    let resolveConfig!: (response: Response) => void;
    const fetchConfig = vi.fn(() => new Promise<Response>((resolve) => { resolveConfig = resolve; }));
    vi.stubGlobal("fetch", fetchConfig);
    const server = new MafiaRoomSession(harness.room as never);
    const connections = [harness.addConnection("one"), harness.addConnection("two")];
    const joins = connections.map((connection) => {
      server.onConnect(connection, {});
      return server.onMessage(JSON.stringify({
        type: "event", event: "playerJoinRoom", args: [""], callbackId: connection.id,
      }), connection);
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    resolveConfig(Response.json({
      size: 3,
      roleSelection: { algorithm: "weighted-random", roles: [{ role: "doctor" }], explicitSlots: [] },
    }));
    await Promise.all(joins);
    expect(fetchConfig).toHaveBeenCalledOnce();
    for (const connection of connections) {
      expect(parseMessages(harness.sentByConnection.get(connection.id)!)).toContainEqual(
        expect.objectContaining({ callbackId: connection.id, args: [{ status: "joined", username: expect.any(String) }] }),
      );
    }
  });

  it("does not expose room diagnostics or allow deletion with missing or wrong credentials", async () => {
    const harness = createPartyRoom();
    Object.assign(harness.room.env, { BACKEND_SECRET: "secret" });
    const server = new MafiaRoomSession(harness.room as never);
    for (const method of ["GET", "DELETE"]) {
      for (const authorization of [undefined, "Bearer wrong", "Bearer undefined"]) {
        const response = await server.onRequest(new Request("https://worker.test/parties/main/test-room", {
          method, headers: authorization ? { authorization } : {},
        }));
        expect(response.status).toBe(404);
      }
    }
    const authorized = await server.onRequest(new Request("https://worker.test/parties/main/test-room", {
      headers: { authorization: "Bearer secret" },
    }));
    expect(authorized.status).toBe(200);
    expect(await authorized.json()).toEqual(expect.objectContaining({ roomId: "test-room", connections: 0 }));
  });

  it("rejects unversioned production actions and never broadcasts their payload", async () => {
    const harness = createPartyRoom(false);
    const server = new MafiaRoomSession(harness.room as never);
    const connection = harness.addConnection("production");
    server.onConnect(connection, {});
    await server.onMessage(JSON.stringify({ type: "event", event: "playerJoinRoom", args: [""], callbackId: "join" }), connection);
    const offset = harness.sentByConnection.get(connection.id)!.length;
    await server.onMessage(JSON.stringify({ type: "event", event: "messageSentByUser", args: ["not delivered", "Day"] }), connection);
    expect(parseMessages(harness.sentByConnection.get(connection.id)!.slice(offset))).toEqual([
      expect.objectContaining({ type: "command-ack", accepted: false, reason: "version-required" }),
    ]);
  });

  it("accepts binary frames while ignoring unknown connections", async () => {
    const harness = createPartyRoom();
    const server = new MafiaRoomSession(harness.room as never);
    const connection = harness.addConnection("binary");
    const message = new TextEncoder().encode(JSON.stringify({ type: "event", event: "playerJoinRoom", args: [""], callbackId: "binary-join" }));
    await server.onMessage(message, connection);
    expect(harness.sentByConnection.get(connection.id)).toEqual([]);
    server.onConnect(connection, {});
    await server.onMessage(message, connection);
    expect(parseMessages(harness.sentByConnection.get(connection.id)!)).toContainEqual(
      expect.objectContaining({ callbackId: "binary-join", args: [{ status: "joined", username: expect.any(String) }] }),
    );
  });
});
