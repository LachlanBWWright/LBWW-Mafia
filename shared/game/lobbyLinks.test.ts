import { describe, expect, it } from "vitest";
import { createLobbyLink, isLobbyRoomId, parseLobbyLink } from "./lobbyLinks";

describe("lobby invitation links", () => {
  const origin = "https://mafia.example";
  it("replaces existing paths and parameters without carrying secrets", () => {
    const link = createLobbyLink(
      `${origin}/account?token=secret#private`,
      "friday-night",
    );
    expect(link).toBe(`${origin}/lobby?room=friday-night`);
    expect(parseLobbyLink(link, origin)).toBe("friday-night");
  });
  it("opens the registered native scheme", () => {
    expect(parseLobbyLink("mernmafia://lobby?room=friday-night", origin)).toBe(
      "friday-night",
    );
  });
  it.each([
    "https://evil.example/lobby?room=friday-night",
    "https://mafia.example/account?room=friday-night",
    "https://mafia.example/lobby?room=one&room=two",
    "https://mafia.example/lobby?room=../private",
    "https://user:secret@mafia.example/lobby?room=one",
    "javascript:alert(1)",
    "mernmafia://account?room=one",
    "mernmafia://lobby/private?room=one",
  ])("rejects unsupported links: %s", (link) => {
    expect(parseLobbyLink(link, origin)).toBeNull();
  });
  it("uses the same ID limits for creation and parsing", () => {
    expect(isLobbyRoomId("a".repeat(64))).toBe(true);
    expect(isLobbyRoomId("a".repeat(65))).toBe(false);
    expect(() => createLobbyLink(origin, "bad/room")).toThrow();
    expect(() => createLobbyLink("javascript:alert(1)", "room")).toThrow();
  });
});
