import { describe, expect, it } from "vitest";
import { activeSession } from "./activeSession";
describe("read-only web authentication", () => {
  it("treats revoked sessions with stale identity fields as signed out", () => {
    expect(
      activeSession({ user: { id: "", name: "Stale identity" } }),
    ).toBeNull();
    expect(activeSession(null)).toBeNull();
  });
  it("preserves a session with an authenticated subject", () => {
    const session = { user: { id: "google-account" } };
    expect(activeSession(session)).toBe(session);
  });
});
