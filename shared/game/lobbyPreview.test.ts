import { afterEach, describe, expect, it, vi } from "vitest";
import { lobbyConfigSchema } from "./lobbyConfig";
import { createLobbyPreview, requestLobbyPreview } from "./lobbyPreview";
const config = lobbyConfigSchema.parse({
  size: 2,
  roleSelection: {
    algorithm: "explicit-slots",
    roles: [],
    explicitSlots: ["doctor", "mafia"],
  },
});
afterEach(() => vi.unstubAllGlobals());
describe("public custom lobby preview", () => {
  it("shows the runtime timing for legacy setups without explicit rules", () => {
    expect(createLobbyPreview("legacy", config).setup.rules.timing.daySeconds).toBe(18);
    expect(createLobbyPreview("new", { ...config, rules: {} }).setup.rules.timing.daySeconds).toBe(60);
  });
  it("never discloses hidden role pools, ownership, weights or assignments", () => {
    const result = createLobbyPreview("custom-1", config);
    expect(result.setup.rolePool).toBeUndefined();
    expect(Object.keys(result).sort()).toEqual(["roomId", "setup", "size"]);
    expect(JSON.stringify(result)).not.toContain("explicitSlots");
    expect(JSON.stringify(result)).not.toContain("ownerId");
  });
  it("publishes role pools only when enabled", () => {
    const result = createLobbyPreview("custom-1", {
      ...config,
      rules: { reveal: { rolePool: true } },
    });
    expect(result.setup.rolePool).toEqual(["doctor", "mafia"]);
  });
  it("treats only a 404 as a normal room and keeps failures recoverable", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await requestLobbyPreview("normal")).toBeNull();
    await expect(requestLobbyPreview("normal")).rejects.toThrow(
      "Please try again",
    );
  });
  it("rejects invalid or cross-room responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json(createLobbyPreview("other", config))),
    );
    await expect(requestLobbyPreview("requested")).rejects.toThrow(
      "did not match",
    );
  });
});

it("cleans up its timeout and upstream listener after success", async () => {
  vi.useFakeTimers();
  try {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    await requestLobbyPreview("normal", "", controller.signal);
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  } finally {
    vi.useRealTimers();
  }
});
it("propagates cancellation and bounds pending requests without AbortSignal static methods", async () => {
  vi.useFakeTimers();
  try {
    const fetcher = vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => reject(new Error("Request aborted")),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const cancelled = requestLobbyPreview("normal", "", controller.signal);
    const cancelledAssertion =
      expect(cancelled).rejects.toThrow("Request aborted");
    controller.abort();
    await cancelledAssertion;
    expect(vi.getTimerCount()).toBe(0);
    const stalled = requestLobbyPreview("normal");
    const timeoutAssertion = expect(stalled).rejects.toThrow("Request aborted");
    await vi.advanceTimersByTimeAsync(10000);
    await timeoutAssertion;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
