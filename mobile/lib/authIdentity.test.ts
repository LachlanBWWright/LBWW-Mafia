import { describe, expect, it } from "vitest";
import { authIdentity } from "./authIdentity";
const token = (sub: string, sessionId: string, exp: number) =>
  `${Buffer.from(JSON.stringify({ sub, sessionId, exp, kind: "mobile" })).toString("base64url")}.signature`;
describe("native navigation account identity", () => {
  it("keeps navigation when access credentials refresh for the same account", () => {
    expect(authIdentity(token("player-one", "first-session", 100))).toBe(
      "account:player-one",
    );
    expect(authIdentity(token("player-one", "refreshed-session", 200))).toBe(
      authIdentity(token("player-one", "first-session", 100)),
    );
  });
  it("remounts private screens when switching accounts or signing out", () => {
    expect(authIdentity(token("player-one", "first", 100))).not.toBe(
      authIdentity(token("player-two", "second", 100)),
    );
    expect(authIdentity(null)).toBe("signed-out");
  });
  it("handles malformed tokens and missing subjects as signed out", () => {
    for (const value of [
      "",
      "broken",
      "not-base64.signature",
      "e30.signature",
      `${Buffer.from(JSON.stringify({ sub: 42 })).toString("base64url")}.signature`,
      `${Buffer.from(JSON.stringify({ sub: " " })).toString("base64url")}.signature`,
      "payload.",
      "a.b.c",
    ])
      expect(authIdentity(value)).toBe("signed-out");
  });
  it("decodes UTF-8 account subjects consistently", () => {
    expect(authIdentity(token("玩家", "session", 100))).toBe("account:玩家");
  });
});
