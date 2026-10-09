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
});
