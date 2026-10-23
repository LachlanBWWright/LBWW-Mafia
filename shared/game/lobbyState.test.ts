import { describe, expect, it } from "vitest";
import { DayTime } from "../communication/events";
import { initialLobbyState, lobbyReducer } from "./lobbyState";
describe("shared web/mobile lobby reducer", () => {
  it("resynchronizes a returning player's permissions, roster, phase, and role without losing chat", () => {
    const prior = lobbyReducer(initialLobbyState, {
      type: "message",
      text: "hello",
    });
    const state = lobbyReducer(prior, {
      type: "snapshot",
      value: {
        playerName: "Mira",
        players: [{ name: "Mira", isAlive: false, role: "Doctor" }],
        time: DayTime.Night,
        dayNumber: 3,
        timeLeft: 9,
        canTalk: false,
        canVote: false,
      },
    });
    expect(state.messages).toEqual(prior.messages);
    expect(state.playerName).toBe("Mira");
    expect(state.canTalk).toBe(false);
    expect(state.time).toBe(DayTime.Night);
    expect(lobbyReducer(state, { type: "tick" }).timeLeft).toBe(8);
  });
  it("updates faction roles on both clients and prevents duplicate players", () => {
    const state = lobbyReducer(initialLobbyState, {
      type: "add",
      player: { name: "Mira" },
    });
    expect(lobbyReducer(state, { type: "add", player: { name: "Mira" } })).toBe(
      state,
    );
    expect(
      lobbyReducer(state, {
        type: "role",
        player: { name: "Mira", role: "Mafia" },
      }).players[0]?.role,
    ).toBe("Mafia");
  });

  it("marks eliminated players dead, preserves their revealed role, and removes leavers", () => {
    const withPlayers = lobbyReducer(
      lobbyReducer(initialLobbyState, {
        type: "add",
        player: { name: "Mira" },
      }),
      { type: "add", player: { name: "Noah" } },
    );
    const revealed = lobbyReducer(withPlayers, {
      type: "role",
      player: { name: "Noah", role: "Investigator" },
      dead: true,
    });

    expect(revealed.players[1]).toMatchObject({
      name: "Noah",
      role: "Investigator",
      isAlive: false,
    });
    expect(
      lobbyReducer(revealed, { type: "remove", name: "Mira" }).players,
    ).toEqual([revealed.players[1]]);
  });

  it("caps retained chat history while assigning ids in order", () => {
    let state = initialLobbyState;
    for (let index = 0; index < 503; index += 1)
      state = lobbyReducer(state, {
        type: "message",
        text: `message-${index}`,
      });

    expect(state.messages).toHaveLength(500);
    expect(state.messages[0]).toEqual({ id: 4, text: "message-3" });
    expect(state.messages.at(-1)).toEqual({ id: 503, text: "message-502" });
  });
});

it("preserves state identity for expired ticks and unchanged connection status", () => {
  expect(lobbyReducer(initialLobbyState, { type: "tick" })).toBe(
    initialLobbyState,
  );
  expect(
    lobbyReducer(initialLobbyState, { type: "connection", connected: false }),
  ).toBe(initialLobbyState);
  const connected = lobbyReducer(initialLobbyState, {
    type: "connection",
    connected: true,
  });
  expect(connected.connected).toBe(true);
  expect(lobbyReducer(connected, { type: "connection", connected: true })).toBe(
    connected,
  );
  const ticking = { ...connected, timeLeft: 1 };
  const expired = lobbyReducer(ticking, { type: "tick" });
  expect(expired.timeLeft).toBe(0);
  expect(expired.messages).toBe(ticking.messages);
  expect(lobbyReducer(expired, { type: "tick" })).toBe(expired);
});

describe("countdown and transport state stability", () => {
  it.each([0, -1, -25])(
    "keeps the same state for expired countdown %s",
    (timeLeft) => {
      const state = { ...initialLobbyState, timeLeft };
      expect(lobbyReducer(state, { type: "tick" })).toBe(state);
    },
  );

  it("changes only remaining time until expiry, then stops producing state updates", () => {
    const state = { ...initialLobbyState, timeLeft: 2 };
    const first = lobbyReducer(state, { type: "tick" });
    const expired = lobbyReducer(first, { type: "tick" });
    expect(first).toEqual({ ...state, timeLeft: 1 });
    expect(first).not.toBe(state);
    expect(expired).toEqual({ ...state, timeLeft: 0 });
    expect(first.messages).toBe(state.messages);
    expect(first.players).toBe(state.players);
    expect(first.action).toBe(state.action);
    expect(lobbyReducer(expired, { type: "tick" })).toBe(expired);
    expect(state.timeLeft).toBe(2);
  });

  it.each([false, true])(
    "preserves identity for repeated connection status %s",
    (connected) => {
      const state = { ...initialLobbyState, connected };
      expect(lobbyReducer(state, { type: "connection", connected })).toBe(
        state,
      );
      const changed = lobbyReducer(state, {
        type: "connection",
        connected: !connected,
      });
      expect(changed).toEqual({ ...state, connected: !connected });
      expect(changed).not.toBe(state);
      expect(changed.messages).toBe(state.messages);
      expect(changed.players).toBe(state.players);
      expect(changed.action).toBe(state.action);
      expect(
        lobbyReducer(changed, { type: "connection", connected: !connected }),
      ).toBe(changed);
    },
  );

  it("resumes a previously expired clock when the server advances the phase", () => {
    const nextPhase = lobbyReducer(initialLobbyState, {
      type: "phase",
      value: { time: DayTime.Night, dayNumber: 1, timeLeft: 30 },
    });
    expect(lobbyReducer(nextPhase, { type: "tick" })).toEqual({
      ...nextPhase,
      timeLeft: 29,
    });
  });
});
