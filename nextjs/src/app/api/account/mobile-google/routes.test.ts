import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guardRequest: vi.fn(),
  isGoogleSignInConfigured: vi.fn(),
  readJson: vi.fn(),
  startMobileGoogle: vi.fn(),
  consumeMobileGoogle: vi.fn(),
  createMobileSession: vi.fn(),
  getActiveIdentity: vi.fn(),
}));

vi.mock("~/server/auth/googleConfiguration", () => ({
  isGoogleSignInConfigured: mocks.isGoogleSignInConfigured,
}));
vi.mock("~/server/reliability/requests", () => ({
  guardRequest: mocks.guardRequest,
  readJson: mocks.readJson,
}));
vi.mock("~/server/auth/mobileGoogle", () => ({
  startMobileGoogle: mocks.startMobileGoogle,
  consumeMobileGoogle: mocks.consumeMobileGoogle,
}));
vi.mock("~/server/auth/mobileToken", () => ({
  createMobileSession: mocks.createMobileSession,
}));
vi.mock("~/server/auth/identity", () => ({
  getActiveIdentity: mocks.getActiveIdentity,
}));

import { POST as start } from "./start/route";
import { POST as exchange } from "./exchange/route";

const state = "s".repeat(43);
const code = "c".repeat(43);
const verifier = "v".repeat(64);
const challenge = "h".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isGoogleSignInConfigured.mockReturnValue(true);
  mocks.guardRequest.mockResolvedValue(null);
  mocks.readJson.mockImplementation((request: Request) => request.json());
  mocks.startMobileGoogle.mockResolvedValue(state);
  mocks.consumeMobileGoogle.mockResolvedValue("account-2");
  mocks.getActiveIdentity.mockResolvedValue({
    id: "account-2",
    name: "Mafia Player",
    handle: "player",
    isAdmin: false,
  });
  mocks.createMobileSession.mockResolvedValue({
    token: "access",
    refreshToken: "refresh",
    sessionId: "device",
  });
});

describe("mobile Google sign-in routes", () => {
  it("does not create a mobile OAuth flow without Google credentials", async () => {
    mocks.isGoogleSignInConfigured.mockReturnValue(false);
    const response = await start(
      new Request("http://localhost/start", {
        method: "POST",
        body: JSON.stringify({ challenge }),
      }),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Google sign-in is unavailable right now.",
    });
    expect(mocks.startMobileGoogle).not.toHaveBeenCalled();
  });

  it("validates a PKCE challenge and returns a non-cacheable state", async () => {
    const invalid = await start(
      new Request("http://localhost/start", {
        method: "POST",
        body: JSON.stringify({ challenge: "short" }),
      }),
    );
    expect(invalid.status).toBe(400);
    expect(mocks.startMobileGoogle).not.toHaveBeenCalled();

    const response = await start(
      new Request("http://localhost/start", {
        method: "POST",
        body: JSON.stringify({ challenge }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ state });
    expect(mocks.startMobileGoogle).toHaveBeenCalledWith(challenge);
  });

  it("exchanges a valid callback for the active account's mobile session", async () => {
    const response = await exchange(
      new Request("http://localhost/exchange", {
        method: "POST",
        body: JSON.stringify({ state, code, verifier, deviceName: "Pixel" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.consumeMobileGoogle).toHaveBeenCalledWith(
      state,
      code,
      verifier,
    );
    expect(mocks.createMobileSession).toHaveBeenCalledWith(
      expect.objectContaining({ id: "account-2" }),
      "Pixel",
    );
    await expect(response.json()).resolves.toMatchObject({
      token: "access",
      refreshToken: "refresh",
      sessionId: "device",
      user: { id: "account-2", handle: "player", isAdmin: false },
    });
  });

  it("rejects malformed, expired, and inactive-account callbacks", async () => {
    const malformed = await exchange(
      new Request("http://localhost/exchange", {
        method: "POST",
        body: JSON.stringify({ state, code: "bad", verifier }),
      }),
    );
    expect(malformed.status).toBe(400);
    expect(mocks.consumeMobileGoogle).not.toHaveBeenCalled();

    mocks.consumeMobileGoogle.mockResolvedValueOnce(null);
    const expired = await exchange(
      new Request("http://localhost/exchange", {
        method: "POST",
        body: JSON.stringify({ state, code, verifier }),
      }),
    );
    expect(expired.status).toBe(401);

    mocks.getActiveIdentity.mockResolvedValueOnce(null);
    const inactive = await exchange(
      new Request("http://localhost/exchange", {
        method: "POST",
        body: JSON.stringify({ state, code, verifier }),
      }),
    );
    expect(inactive.status).toBe(401);
    expect(mocks.createMobileSession).not.toHaveBeenCalled();
  });
});
