import { describe, expect, it } from "vitest";
import { lobbyNavigationFromUrl } from "./lobbyNavigation";
describe("native lobby invitation navigation", () => {
  it("routes trusted website and native links to the same lobby", () => {
    const params = { roomId: "friday-game", spectator: false };
    expect(
      lobbyNavigationFromUrl(
        "https://mafia.test/lobby?room=friday-game",
        "https://mafia.test",
      )?.routes[0]?.params,
    ).toEqual(params);
    expect(
      lobbyNavigationFromUrl(
        "mernmafia://lobby?room=friday-game",
        "https://mafia.test",
      )?.routes[0]?.params,
    ).toEqual(params);
  });
  it("supports an explicit watching link without granting actions", () => {
    expect(
      lobbyNavigationFromUrl(
        "mernmafia://lobby?room=game&spectate=1",
        "https://mafia.test",
      )?.routes[0]?.params,
    ).toEqual({ roomId: "game", spectator: true });
  });
  it("rejects foreign hosts and ambiguous or malformed room IDs", () => {
    for (const url of [
      "https://evil.test/lobby?room=game",
      "mernmafia://other?room=game",
      "mernmafia://lobby?room=one&room=two",
      "mernmafia://lobby?room=%20",
    ])
      expect(lobbyNavigationFromUrl(url, "https://mafia.test")).toBeUndefined();
  });
});
