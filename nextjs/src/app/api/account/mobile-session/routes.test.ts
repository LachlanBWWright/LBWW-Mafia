import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  guardRequest: vi.fn(),
  readJson: vi.fn(),
  refreshMobileSession: vi.fn(),
  revokeMobileSession: vi.fn(),
}));

vi.mock("~/server/reliability/requests", () => ({
  guardRequest: mocks.guardRequest,
  readJson: mocks.readJson,
}));
vi.mock("~/server/auth/mobileToken", () => ({
  refreshMobileSession: mocks.refreshMobileSession,
  revokeMobileSession: mocks.revokeMobileSession,
}));

import { POST as refresh } from "../mobile-refresh/route";
import { POST as logout } from "../mobile-logout/route";

const refreshToken = "r".repeat(64);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guardRequest.mockResolvedValue(null);
  mocks.readJson.mockImplementation((request: Request) => request.json());
  mocks.refreshMobileSession.mockResolvedValue({
    token: "new-access",
    refreshToken: "new-refresh",
    sessionId: "device-1",
  });
});

describe("mobile session routes", () => {
  it("validates refresh credentials and returns rotated session tokens", async () => {
    const invalid = await refresh(
      new Request("http://localhost/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "short" }),
      }),
    );
    expect(invalid.status).toBe(401);
    expect(mocks.refreshMobileSession).not.toHaveBeenCalled();

    const response = await refresh(
      new Request("http://localhost/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.refreshMobileSession).toHaveBeenCalledWith(refreshToken);
    await expect(response.json()).resolves.toMatchObject({
      token: "new-access",
      refreshToken: "new-refresh",
    });

    mocks.refreshMobileSession.mockResolvedValueOnce(null);
    const expired = await refresh(
      new Request("http://localhost/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),
    );
    expect(expired.status).toBe(401);
  });

  it("revokes valid logout tokens idempotently and returns no content", async () => {
    const invalid = await logout(
      new Request("http://localhost/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken: "short" }),
      }),
    );
    expect(invalid.status).toBe(204);
    expect(mocks.revokeMobileSession).not.toHaveBeenCalled();

    const response = await logout(
      new Request("http://localhost/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }),
    );
    expect(response.status).toBe(204);
    expect(mocks.revokeMobileSession).toHaveBeenCalledWith(refreshToken);
  });
});
