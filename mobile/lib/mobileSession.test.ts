import { afterEach, beforeEach, expect, it, vi } from "vitest";
const store = vi.hoisted(() => ({
  values: new Map<string, string>(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock("expo-secure-store", () => store);
const token = (exp: number) => `${btoa(JSON.stringify({ exp }))}.signature`;
beforeEach(() => {
  vi.resetModules();
  store.values.clear();
  vi.clearAllMocks();
  store.getItemAsync.mockImplementation(
    async (key: string) => store.values.get(key) ?? null,
  );
  store.setItemAsync.mockImplementation(async (key: string, value: string) => {
    store.values.set(key, value);
  });
  store.deleteItemAsync.mockImplementation(async (key: string) => {
    store.values.delete(key);
  });
});
afterEach(() => vi.unstubAllGlobals());
it("shares one rotating refresh across simultaneous native requests", async () => {
  const session = await import("./mobileSession"),
    auth = await import("./authToken");
  const expired = token(1),
    next = token(Date.now() + 100_000);
  await session.saveMobileSession({
    token: expired,
    refreshToken: "old-refresh",
    sessionId: "device",
  });
  auth.setAuthToken(expired);
  const fetch = vi.fn(async () =>
    Response.json({
      token: next,
      refreshToken: "next-refresh",
      sessionId: "device",
    }),
  );
  vi.stubGlobal("fetch", fetch);
  expect(
    await Promise.all([session.getAccessToken(), session.getAccessToken()]),
  ).toEqual([next, next]);
  expect(fetch).toHaveBeenCalledOnce();
  expect(
    JSON.parse(store.values.get("lbww-mobile-session")!).refreshToken,
  ).toBe("next-refresh");
});
it("sign-out wins over a late refresh response", async () => {
  const session = await import("./mobileSession"),
    auth = await import("./authToken");
  const expired = token(1);
  await session.saveMobileSession({
    token: expired,
    refreshToken: "old-refresh",
    sessionId: "device",
  });
  auth.setAuthToken(expired);
  let complete!: (response: Response) => void;
  const fetch = vi.fn((url: string) =>
    url.endsWith("mobile-refresh")
      ? new Promise<Response>((resolve) => {
          complete = resolve;
        })
      : Promise.resolve(new Response(null, { status: 204 })),
  );
  vi.stubGlobal("fetch", fetch);
  const refreshing = session.getAccessToken();
  await vi.waitFor(() => expect(complete).toBeTypeOf("function"));
  auth.setAuthToken(null);
  await session.clearMobileSession();
  complete(
    Response.json({
      token: token(Date.now() + 100_000),
      refreshToken: "new-refresh",
      sessionId: "device",
    }),
  );
  expect(await refreshing).toBeNull();
  expect(auth.getAuthToken()).toBeNull();
  expect(store.values.has("lbww-mobile-session")).toBe(false);
});

it("clears a revoked session after an unauthorized API response", async () => {
  const session = await import("./mobileSession"),
    auth = await import("./authToken");
  const current = token(Date.now() + 100_000);
  await session.saveMobileSession({
    token: current,
    refreshToken: "refresh",
    sessionId: "device",
  });
  auth.setAuthToken(current);
  const fetch = vi.fn(
    async (url: string) =>
      new Response(null, { status: url.endsWith("mobile-logout") ? 204 : 401 }),
  );
  vi.stubGlobal("fetch", fetch);
  expect(
    (await session.authenticatedFetch("http://test/api/trpc/account.profile"))
      .status,
  ).toBe(401);
  expect(auth.getAuthToken()).toBeNull();
  expect(store.values.has("lbww-mobile-session")).toBe(false);
});
