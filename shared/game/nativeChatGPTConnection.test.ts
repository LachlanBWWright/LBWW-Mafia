import { afterEach, describe, expect, it, vi } from "vitest";
import { disconnectedChatGPTAccount } from "./chatGPTConnection";
import {
  createNativeChatGPTClient,
  type NativeChatGPTInvoke,
} from "./nativeChatGPTConnection";

afterEach(() => {
  vi.useRealTimers();
});

describe("native ChatGPT bridge", () => {
  it("reuses an enabled account without launching another authorization", async () => {
    const invoke = vi.fn<NativeChatGPTInvoke>(async () => ({
      ...disconnectedChatGPTAccount,
      connected: true,
      planEnabled: true,
    }));
    const account = await createNativeChatGPTClient(invoke).connect(
      new AbortController().signal,
      vi.fn(),
      vi.fn(),
    );
    expect(account.planEnabled).toBe(true);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("status", undefined);
  });
  it("joins an existing authorization without starting a duplicate flow", async () => {
    let reads = 0;
    const invoke = vi.fn<NativeChatGPTInvoke>(async () => ({
      ...disconnectedChatGPTAccount,
      signingIn: ++reads === 1,
      connected: reads > 1,
      planEnabled: false,
    }));
    const account = await createNativeChatGPTClient(invoke).connect(
      new AbortController().signal,
      vi.fn(),
      vi.fn(),
    );
    expect(account.connected).toBe(true);
    expect(account.planEnabled).toBe(false);
    expect(invoke.mock.calls.every(([method]) => method === "status")).toBe(
      true,
    );
  });
  it.each(["declined", "failed"])(
    "surfaces %s authorization without returning success",
    async (kind) => {
      const invoke = vi.fn<NativeChatGPTInvoke>(async (method) =>
        method === "connect"
          ? {}
          : {
              ...disconnectedChatGPTAccount,
              error:
                kind === "failed"
                  ? { code: "identity", message: "Identity failed." }
                  : null,
            },
      );
      await expect(
        createNativeChatGPTClient(invoke).connect(
          new AbortController().signal,
          vi.fn(),
          vi.fn(),
        ),
      ).rejects.toThrow(
        kind === "failed" ? "Identity failed." : "did not complete",
      );
    },
  );
  it("times out pending authorization, cancels it once and removes the abort subscription", async () => {
    vi.useFakeTimers();
    const invoke = vi.fn<NativeChatGPTInvoke>(async () => ({
      ...disconnectedChatGPTAccount,
      signingIn: true,
    }));
    const controller = new AbortController();
    const connecting = createNativeChatGPTClient(invoke).connect(
      controller.signal,
      vi.fn(),
      vi.fn(),
    );
    const rejected = expect(connecting).rejects.toThrow("expired");
    await vi.advanceTimersByTimeAsync(201_000);
    await rejected;
    controller.abort();
    expect(
      invoke.mock.calls.filter(([method]) => method === "cancel"),
    ).toHaveLength(1);
  });
  it("validates metadata and results, strips extra fields and forwards successful commands", async () => {
    const invoke = vi.fn<NativeChatGPTInvoke>(async (method) => {
      if (method === "models")
        return [
          { slug: "available", name: "Available", accessToken: "private" },
        ];
      if (method === "disconnect")
        return { remoteRevocationConfirmed: false, refreshToken: "private" };
      if (method === "join") return { added: 1 };
      return {};
    });
    const client = createNativeChatGPTClient(invoke);
    const signal = new AbortController().signal;
    expect(await client.models(signal)).toEqual([
      { slug: "available", name: "Available" },
    ]);
    await client.cancel(signal);
    await client.retry(signal);
    expect(await client.disconnect(signal)).toEqual({
      remoteRevocationConfirmed: false,
    });
    expect(
      await client.join(
        {
          socketUrl: "https://game.example",
          room: " room ",
          tickets: ["ticket"],
          model: "available",
          mode: "shared",
          personality: "varied",
          difficulty: "standard",
        },
        signal,
      ),
    ).toEqual({ added: 1 });
    expect(
      invoke.mock.calls.find(([method]) => method === "join")?.[1],
    ).toMatchObject({ room: "room" });
    invoke.mockResolvedValue({ added: -1 });
    await expect(
      client.join(
        {
          socketUrl: "https://game.example",
          room: "room",
          tickets: ["ticket"],
          model: "available",
          mode: "shared",
          personality: "varied",
          difficulty: "standard",
        },
        signal,
      ),
    ).rejects.toThrow();
    invoke.mockResolvedValue({ connected: "yes" });
    await expect(client.status(signal)).rejects.toThrow();
    invoke.mockResolvedValue([{ slug: "", name: "invalid" }]);
    await expect(client.models(signal)).rejects.toThrow();
  });
  it("does not apply native results after the caller aborts", async () => {
    const controller = new AbortController();
    let resolve: (value: unknown) => void = () => undefined;
    const invoke = vi.fn<NativeChatGPTInvoke>(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const client = createNativeChatGPTClient(invoke);
    const models = client.models(controller.signal);
    controller.abort();
    resolve([]);
    await expect(models).rejects.toThrow();
    invoke.mockClear();
    await expect(client.status(controller.signal)).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
  it("opens sign-in in the native runtime and enables a previously declined grant", async () => {
    let enabled = false;
    const invoke = vi.fn<NativeChatGPTInvoke>(async (method) => {
      if (method === "connect") {
        enabled = true;
        return {};
      }
      return {
        ...disconnectedChatGPTAccount,
        connected: true,
        planEnabled: enabled,
        email: "user@example.invalid",
        accessToken: "must-not-cross",
      };
    });
    const open = vi.fn();
    const client = createNativeChatGPTClient(invoke);
    const account = await client.connect(
      new AbortController().signal,
      open,
      vi.fn(),
    );
    expect(account.planEnabled).toBe(true);
    expect(account).not.toHaveProperty("accessToken");
    expect(invoke).toHaveBeenCalledWith("connect", undefined);
    expect(open).not.toHaveBeenCalled();
  });
  it("cancels authorization even while the native start operation is pending", async () => {
    let release: () => void = () => undefined;
    let started: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const invoke = vi.fn<NativeChatGPTInvoke>(async (method) => {
      if (method === "status") return disconnectedChatGPTAccount;
      if (method === "connect") {
        started();
        await pending;
        return {};
      }
      if (method === "cancel") {
        release();
        return {};
      }
      throw new Error("unexpected");
    });
    const controller = new AbortController();
    const connecting = createNativeChatGPTClient(invoke).connect(
      controller.signal,
      vi.fn(),
      vi.fn(),
    );
    await ready;
    controller.abort();
    await expect(connecting).rejects.toThrow();
    expect(invoke).toHaveBeenCalledWith("cancel");
  });
  it("validates bot commands before invoking native code", async () => {
    const invoke = vi.fn<NativeChatGPTInvoke>();
    const client = createNativeChatGPTClient(invoke);
    await expect(
      client.join(
        {
          socketUrl: "https://game.example",
          room: "room",
          tickets: [],
          model: "model",
          mode: "shared",
          personality: "varied",
          difficulty: "standard",
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
});
