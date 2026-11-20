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
  db: { transaction: vi.fn(), select: vi.fn() },
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
vi.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_SOCKET_URL: "https://game.example",
    BACKEND_SECRET: "test-secret",
  },
}));
vi.mock("drizzle-orm", () => ({ eq: mocks.eq, desc: vi.fn(), sql: vi.fn() }));
vi.mock("@mernmafia/db/schema", () => ({
  customLobbies: {
    roomId: "customLobbies.roomId",
    config: "config",
    createdAt: "createdAt",
  },
  users: { id: "users.id" },
}));

import { GET, POST } from "./route";

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

describe("public lobby directory", () => {
  it("provides a next page when more public rooms exist", async () => {
    const row = {
      roomId: "public",
      config: JSON.stringify({
        ...config,
        directory: { public: true, name: "Game" },
      }),
    };
    const offset = vi
      .fn()
      .mockResolvedValue(
        Array.from({ length: 51 }, (_, index) => ({
          ...row,
          roomId: `room-${index}`,
        })),
      );
    mocks.db.select.mockReturnValue({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: () => ({ offset }) }) }),
      }),
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(async () =>
          Response.json({
            players: 1,
            started: false,
            ended: false,
            closed: false,
          }),
        ),
    );
    try {
      const response = await GET(
        new Request("http://localhost/api/lobbies?offset=50"),
      );
      const result = await response.json();
      expect(offset).toHaveBeenCalledWith(50);
      expect(result.nextOffset).toBe(100);
      expect(result.lobbies).toHaveLength(50);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("returns only opted-in rooms with live occupants and status", async () => {
    const publicConfig = {
      ...config,
      directory: { public: true, name: "Friday game" },
    };
    const rows = [
      { roomId: "public", config: JSON.stringify(publicConfig) },
      { roomId: "private", config: JSON.stringify(config) },
      { roomId: "empty", config: JSON.stringify(publicConfig) },
    ];
    mocks.db.select.mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: () => ({ offset: async () => rows }) }),
        }),
      }),
    });
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      Response.json({
        players: String(url).includes("empty") ? 0 : 1,
        started: false,
        ended: false,
        closed: false,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const response = await GET(new Request("http://localhost/api/lobbies"));
      expect(await response.json()).toEqual({
        nextOffset: null,
        lobbies: [
          {
            roomId: "public",
            name: "Friday game",
            capacity: 2,
            players: 1,
            status: "waiting",
          },
        ],
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
