import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guardRequest: vi.fn(),
  readJson: vi.fn(),
  auth: vi.fn(),
  verifyMobileToken: vi.fn(),
  getActiveIdentity: vi.fn(),
  eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
  tx: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  insertValues: vi.fn(),
  db: { transaction: vi.fn() },
}));

vi.mock("~/server/reliability/requests", () => ({
  guardRequest: mocks.guardRequest,
  readJson: mocks.readJson,
}));
vi.mock("~/server/auth", () => ({ auth: mocks.auth }));
vi.mock("~/server/auth/mobileToken", () => ({
  verifyMobileToken: mocks.verifyMobileToken,
}));
vi.mock("~/server/auth/identity", () => ({
  getActiveIdentity: mocks.getActiveIdentity,
}));
vi.mock("~/server/db", () => ({ db: mocks.db }));
vi.mock("~/env", () => ({ env: {} }));
vi.mock("drizzle-orm", () => ({ eq: mocks.eq }));
vi.mock("@mernmafia/db/schema", () => ({
  customLobbies: { roomId: "customLobbies.roomId" },
  users: { id: "users.id" },
}));

import { POST } from "./route";

const config = {
  size: 2,
  roleSelection: {
    algorithm: "explicit-slots",
    roles: [],
    explicitSlots: ["doctor", "mafia"],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guardRequest.mockResolvedValue(null);
  mocks.readJson.mockImplementation((request: Request) => request.json());
  mocks.auth.mockResolvedValue(null);
  mocks.verifyMobileToken.mockResolvedValue(null);
  mocks.getActiveIdentity.mockResolvedValue(null);
  mocks.tx.select.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        for: async () => [
          { id: "account-1", deletedAt: null, accountStatus: "active" },
        ],
      }),
    }),
  }));
  mocks.tx.insert.mockImplementation(() => ({
    values: mocks.insertValues.mockResolvedValue(undefined),
  }));
  mocks.db.transaction.mockImplementation(
    async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx),
  );
});

describe("custom lobby creation route", () => {
  it("stops at the rate limit before checking identity", async () => {
    mocks.guardRequest.mockResolvedValueOnce(
      Response.json({ error: "Rate limited" }, { status: 429 }),
    );
    const response = await POST(
      new Request("http://localhost/api/lobbies", {
        method: "POST",
        body: JSON.stringify(config),
      }),
    );

    expect(response.status).toBe(429);
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("requires an active signed-in identity and validates the lobby rules", async () => {
    const denied = await POST(
      new Request("http://localhost/api/lobbies", {
        method: "POST",
        body: JSON.stringify(config),
      }),
    );
    expect(denied.status).toBe(401);

    mocks.auth.mockResolvedValueOnce({ user: { id: "account-1" } });
    mocks.getActiveIdentity.mockResolvedValueOnce({ id: "account-1" });
    const invalid = await POST(
      new Request("http://localhost/api/lobbies", {
        method: "POST",
        body: JSON.stringify({ size: 1, roleSelection: {} }),
      }),
    );
    expect(invalid.status).toBe(400);
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("creates an owned lobby for a mobile bearer session", async () => {
    mocks.verifyMobileToken.mockResolvedValue({ sub: "account-1" });
    mocks.getActiveIdentity.mockResolvedValue({ id: "account-1" });
    const response = await POST(
      new Request("http://localhost/api/lobbies", {
        method: "POST",
        headers: { authorization: "Bearer mobile-token" },
        body: JSON.stringify(config),
      }),
    );

    expect(response.status).toBe(200);
    const { roomId } = (await response.json()) as { roomId: string };
    expect(roomId).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.verifyMobileToken).toHaveBeenCalledWith("mobile-token");
    expect(mocks.db.transaction).toHaveBeenCalledOnce();
    expect(mocks.tx.insert).toHaveBeenCalledOnce();
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId,
        ownerId: "account-1",
        config: JSON.stringify(config),
      }),
    );
  });
});
