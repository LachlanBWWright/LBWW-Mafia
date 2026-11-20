import { afterEach, expect, it, vi } from "vitest";
import { requestRoleSandbox } from "../../shared/game/roleSandboxClient";
import { createCustomRoleDraft } from "../../shared/game/customRoles";
afterEach(() => vi.unstubAllGlobals());
it("validates before sending", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(
    requestRoleSandbox({ role: createCustomRoleDraft(), nights: 6 }),
  ).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects malformed successful responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ nights: [] })),
  );
  await expect(
    requestRoleSandbox({ role: createCustomRoleDraft() }),
  ).rejects.toThrow("invalid result");
});
it("reports unavailable server", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
  );
  await expect(
    requestRoleSandbox({ role: createCustomRoleDraft() }),
  ).rejects.toThrow("503");
});
it("sends validated input and accepts runtime outcomes", async () => {
  const result = {
    nights: [
      {
        night: 1,
        accepted: true,
        targetDamage: 0,
        targetDefence: 1,
        targetBlocked: false,
        redirectedToActor: false,
        notices: [],
      },
    ],
  };
  const fetcher = vi.fn().mockResolvedValue(Response.json(result));
  vi.stubGlobal("fetch", fetcher);
  expect(
    await requestRoleSandbox(
      { role: createCustomRoleDraft(), nights: 1 },
      "https://example.com/api/sandbox",
    ),
  ).toEqual(result);
  expect(fetcher.mock.calls[0]?.[0]).toBe("https://example.com/api/sandbox");
});
it("rejects invalid JSON with a useful response error", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
  await expect(
    requestRoleSandbox({ role: createCustomRoleDraft() }),
  ).rejects.toThrow("invalid result");
});
it("rejects nights returned out of order", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          nights: [
            {
              night: 2,
              accepted: false,
              targetDamage: 0,
              targetDefence: 0,
              targetBlocked: false,
              redirectedToActor: false,
              notices: [],
            },
          ],
        }),
      ),
  );
  await expect(
    requestRoleSandbox({ role: createCustomRoleDraft(), nights: 1 }),
  ).rejects.toThrow("invalid result");
});
it("rejects incomplete scenarios", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          nights: [
            {
              night: 1,
              accepted: false,
              targetDamage: 0,
              targetDefence: 0,
              targetBlocked: false,
              redirectedToActor: false,
              notices: [],
            },
          ],
        }),
      ),
  );
  await expect(
    requestRoleSandbox({ role: createCustomRoleDraft(), nights: 3 }),
  ).rejects.toThrow("invalid result");
});
it("clears the portable request timeout on failures", async () => {
  vi.useFakeTimers();
  try {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    await expect(
      requestRoleSandbox({ role: createCustomRoleDraft() }),
    ).rejects.toThrow("503");
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
it("aborts a stalled request after fifteen seconds without AbortSignal statics", async () => {
  vi.useFakeTimers();
  try {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            options.signal?.addEventListener(
              "abort",
              () => reject(new Error("Request aborted")),
              { once: true },
            );
          }),
      ),
    );
    const result = requestRoleSandbox({ role: createCustomRoleDraft() });
    const assertion = expect(result).rejects.toThrow("Request aborted");
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
