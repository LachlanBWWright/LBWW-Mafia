import {
  ClientEvent,
  DayTime,
  PartyKitMessageType,
  ServerEvent,
} from "../../../shared/communication/events.js";
import {
  partykitServerEnvelopeSchema,
  partykitClientEventEnvelopeSchema,
} from "../../../shared/communication/protocol.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import MafiaPartyServer from "./partykitServer.js";

type TestConnection = {
  id: string;
  send: (message: string) => void;
  close: (code?: number, reason?: string) => void;
};

type TestPartyRoom = {
  id: string;
  name: string;
  env: {
    DEBUG: string;
    ROOM_SIZE: string;
    END_DAY?: string;
    CAPTCHA_KEY?: string;
  };
  broadcast: (message: string) => void;
  getConnection: (id: string) => TestConnection | undefined;
  getConnections: () => Iterable<TestConnection>;
};

function createPartyRoom(roomSize: number, endDay = 3) {
  const connections = new Map<string, TestConnection>();
  const sentByConnection = new Map<string, string[]>();
  const closedConnections = new Map<string, { code?: number; reason?: string }>();
  const room: TestPartyRoom = {
    id: "15-player-integration",
    name: "main",
    env: {
      DEBUG: "true",
      ROOM_SIZE: String(roomSize),
      END_DAY: String(endDay),
    },
    broadcast(message) {
      for (const connection of connections.values()) connection.send(message);
    },
    getConnection(id) {
      return connections.get(id);
    },
    getConnections() {
      return connections.values();
    },
  };

  function addConnection(id: string) {
    const messages: string[] = [];
    const connection: TestConnection = {
      id,
      send(message) {
        messages.push(message);
      },
      close(code, reason) {
        closedConnections.set(id, { code, reason });
      },
    };
    connections.set(id, connection);
    sentByConnection.set(id, messages);
    return connection;
  }

  return { room, addConnection, sentByConnection, closedConnections };
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function parseMessages(messages: string[]) {
  return messages.map((message) => {
    const parsed = JSON.parse(message) as unknown;
    const result = partykitServerEnvelopeSchema.safeParse(parsed);
    expect(result.success, `invalid server envelope: ${message}`).toBe(true);
    return parsed as {
      type: PartyKitMessageType;
      event?: string;
      callbackId?: string;
      args: unknown[];
    };
  });
}

describe("PartyKit multiplayer integration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts a 15-player game and safely routes seeded random interactions", async () => {
    vi.useFakeTimers();
    const playerCount = 15;
    const simulatedDays = 10;
    const harness = createPartyRoom(playerCount, simulatedDays + 2);
    const server = new MafiaPartyServer(harness.room as never);
    const connections = Array.from({ length: playerCount }, (_, index) => {
      const connection = harness.addConnection(`player-${index}`);
      server.onConnect(connection as never, {} as never);
      return connection;
    });

    for (const [index, connection] of connections.entries()) {
      await server.onMessage(
        JSON.stringify({
          type: PartyKitMessageType.Event,
          event: ClientEvent.PlayerJoinRoom,
          args: ["dev-bypass-token", `identity-${index}`],
          callbackId: `join-${index}`,
        }),
        connection as never,
      );
    }

    // startGame is intentionally fire-and-forget from the connection handler.
    await Promise.resolve();

    const random = createSeededRandom(0xc0ffee);
    const targetIndex = () => Math.floor(random() * playerCount);
    const sendEvent = async (
      playerIndex: number,
      event: ClientEvent,
      args: unknown[],
    ) => {
      const envelope = {
        type: PartyKitMessageType.Event,
        event,
        args,
      };
      expect(partykitClientEventEnvelopeSchema.safeParse(envelope).success).toBe(
        true,
      );
      await server.onMessage(JSON.stringify(envelope), connections[playerIndex]! as never);
    };

    expect(
      connections.every(
        (connection) =>
          parseMessages(harness.sentByConnection.get(connection.id) ?? []).some(
            (message) =>
              message.type === PartyKitMessageType.Callback &&
              message.callbackId?.startsWith("join-") &&
              message.args[0] &&
              typeof message.args[0] === "object" &&
              "status" in message.args[0] &&
              message.args[0].status === "joined",
          ),
      ),
    ).toBe(true);

    const initialMessages = connections.flatMap((connection) =>
      parseMessages(harness.sentByConnection.get(connection.id) ?? []),
    );
    const assignedRoles = initialMessages.filter(
      (message) => message.event === ServerEvent.AssignPlayerRole,
    );
    const playerLists = initialMessages.filter(
      (message) => message.event === ServerEvent.ReceivePlayerList,
    );
    expect(assignedRoles).toHaveLength(playerCount);
    expect(playerLists.some((message) => {
      const [players] = message.args;
      return Array.isArray(players) && players.length === playerCount;
    })).toBe(true);

    const sendRandomInteractions = async (
      phase: DayTime,
      safeNightVisits = false,
    ) => {
      for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
        await sendEvent(playerIndex, ClientEvent.MessageSentByUser, [
          `${phase.toLowerCase()} message ${playerIndex}`,
          phase,
        ]);
        await sendEvent(playerIndex, ClientEvent.HandleVote, [
          phase === DayTime.Night ? playerIndex : targetIndex(),
          phase,
        ]);
        await sendEvent(playerIndex, ClientEvent.HandleVisit, [
          safeNightVisits
            ? null
            : playerIndex % 3 === 0
              ? null
              : targetIndex(),
          phase,
        ]);
        await sendEvent(playerIndex, ClientEvent.HandleWhisper, [
          targetIndex(),
          `${phase.toLowerCase()} whisper ${playerIndex}`,
          phase,
        ]);
      }
    };

    // Drive a long multi-day match. Night visits are sent as
    // explicit cancellations so random clicks cannot end the test early via
    // a lethal role action; the night vote, chat, and whisper paths remain
    // exercised for every player.
    await sendRandomInteractions(DayTime.Day);
    await vi.advanceTimersByTimeAsync(5_000);
    for (let dayNumber = 1; dayNumber < simulatedDays; dayNumber += 1) {
      await sendRandomInteractions(DayTime.Night, true);
      await vi.advanceTimersByTimeAsync(15_000);
      if (dayNumber + 1 < simulatedDays) {
        await sendRandomInteractions(DayTime.Day);
        await vi.advanceTimersByTimeAsync(61_000);
      }
    }
    await sendRandomInteractions(DayTime.Day);

    const allMessages = connections.flatMap(
      (connection) => parseMessages(harness.sentByConnection.get(connection.id) ?? []),
    );
    const events = new Set(
      allMessages
        .filter((message) => message.type === PartyKitMessageType.Event)
        .map((message) => message.event),
    );
    const observedDayNumbers = new Set(
      allMessages
        .filter((message) => message.event === ServerEvent.UpdateDayTime)
        .flatMap((message) => {
          const [payload] = message.args;
          return payload && typeof payload === "object" && "dayNumber" in payload
            ? [payload.dayNumber]
            : [];
        }),
    );

    expect(allMessages.filter((message) => message.type === PartyKitMessageType.Callback)).toHaveLength(
      playerCount,
    );
    expect([...events]).toEqual(
      expect.arrayContaining([
        ServerEvent.ReceivePlayerList,
        ServerEvent.AssignPlayerRole,
        ServerEvent.ReceiveMessage,
        ServerEvent.UpdateDayTime,
        ServerEvent.ReceiveChatMessage,
        ServerEvent.ReceiveWhisperMessage,
      ]),
    );
    expect([...observedDayNumbers]).toEqual(
      expect.arrayContaining(
        Array.from({ length: simulatedDays }, (_, index) => index + 1),
      ),
    );
    expect(
      allMessages.some(
        (message) =>
          message.event === ServerEvent.UpdateDayTime &&
          message.args[0] &&
          typeof message.args[0] === "object" &&
          "time" in message.args[0] &&
          message.args[0].time === DayTime.Night,
      ),
    ).toBe(true);
  });
});
