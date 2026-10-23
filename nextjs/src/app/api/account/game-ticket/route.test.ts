import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  guardRequest: vi.fn(),
  getActiveIdentity: vi.fn(),
  verifyMobileToken: vi.fn(),
  env: { BACKEND_SECRET: "ticket-test-secret" },
}));

vi.mock("~/server/reliability/requests", () => ({
  guardRequest: mocks.guardRequest,
  readJson: (request: Request) => request.json(),
}));
vi.mock("~/server/auth", () => ({ auth: mocks.auth }));
vi.mock("~/server/auth/identity", () => ({
  getActiveIdentity: mocks.getActiveIdentity,
}));
vi.mock("~/server/auth/mobileToken", () => ({
  verifyMobileToken: mocks.verifyMobileToken,
}));
vi.mock("~/env", () => ({ env: mocks.env }));

import { GET, POST } from "./route";

const identity = { id: "account-7", name: "Mafia Player", handle: "player" };

function unpackToken(token: string) {
  const [payload, signature] = token.split(".");
  const expected = createHmac("sha256", mocks.env.BACKEND_SECRET)
    .update(payload!)
    .digest("base64url");
  expect(signature).toBe(expected);
  return JSON.parse(Buffer.from(payload!, "base64url").toString("utf8")) as {
    userId: string;
    handle?: string;
    botSeat?: boolean;
    exp: number;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.guardRequest.mockResolvedValue(null);
  mocks.getActiveIdentity.mockResolvedValue(null);
  mocks.verifyMobileToken.mockResolvedValue(null);
});

describe("game-seat tickets", () => {
  it("returns no human ticket when the request has no active account", async () => {
    const response = await GET(
      new Request("http://localhost/api/account/game-ticket"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ token: null });
    expect(mocks.getActiveIdentity).not.toHaveBeenCalled();
  });

  it("creates a short-lived HMAC-signed human ticket for a Google session", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "account-7" } });
    mocks.getActiveIdentity.mockResolvedValue(identity);

    const response = await GET(
      new Request("http://localhost/api/account/game-ticket"),
    );
    const body = (await response.json()) as { token: string };
    const claims = unpackToken(body.token);

    expect(claims).toMatchObject({ userId: "account-7", handle: "player" });
    expect(claims.botSeat).toBeUndefined();
    expect(claims.exp).toBeGreaterThan(Date.now());
    expect(claims.exp).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  it("accepts mobile bearer identity and issues anonymous AI seats without an app login", async () => {
    mocks.verifyMobileToken.mockResolvedValue({ sub: "account-7" });
    mocks.getActiveIdentity.mockResolvedValue(identity);
    const response = await POST(
      new Request("http://localhost/api/account/game-ticket", {
        method: "POST",
        headers: { authorization: "Bearer mobile-access" },
        body: JSON.stringify({ count: 2 }),
      }),
    );
    const body = (await response.json()) as { tokens: string[] };

    expect(mocks.verifyMobileToken).toHaveBeenCalledWith("mobile-access");
    expect(body.tokens).toHaveLength(2);
    expect(body.tokens.map(unpackToken)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "account-7", botSeat: true }),
      ]),
    );
    expect(response.headers.get("cache-control")).toBe("no-store");

    mocks.verifyMobileToken.mockResolvedValue(null);
    mocks.getActiveIdentity.mockResolvedValue(null);
    const denied = await POST(
      new Request("http://localhost/api/account/game-ticket", {
        method: "POST",
        body: JSON.stringify({ count: 1 }),
      }),
    );
    expect(denied.status).toBe(200);
    const guest = (await denied.json()) as { tokens: string[] };
    const claims = unpackToken(guest.tokens[0]!);
    expect(claims).toMatchObject({ botSeat: true, guest: true });
    expect(claims.userId).toBeUndefined();
  });

  it("rate limits AI seat issuance", async () => {
    mocks.guardRequest.mockResolvedValue(new Response(null, { status: 429 }));
    const response = await POST(
      new Request("http://localhost/tickets", { method: "POST" }),
    );
    expect(response.status).toBe(429);
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, 13, "2"])(
    "rejects invalid bot-seat counts: %s",
    async (count) => {
      mocks.auth.mockResolvedValue({ user: { id: "account-7" } });
      mocks.getActiveIdentity.mockResolvedValue(identity);
      const response = await POST(
        new Request("http://localhost/api/account/game-ticket", {
          method: "POST",
          body: JSON.stringify({ count }),
        }),
      );

      expect(response.status).toBe(400);
    },
  );
});
