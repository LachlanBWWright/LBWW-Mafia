import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from "node:crypto";
import type { CallbackModule } from "./chatGPTAuthorization";
import type { BotSocket } from "../../shared/ai/partyRunner.mjs";
import type { GenerateInput } from "../../shared/ai/runtime.mjs";

const state = vi.hoisted(() => ({
  native: null as CallbackModule | null,
  storage: new Map<string, string>(),
  write: vi.fn(),
  fetch: vi.fn(),
  browser: vi.fn(),
  platform: { OS: "android" },
  appState: vi.fn(),
  pause: vi.fn(),
  startSeats: vi.fn(),
  runnerPorts: null as null | {
    WebSocket: new (url: string) => BotSocket;
    generate(input: GenerateInput): Promise<string>;
  },
  groups: [] as Array<
    Array<{ close(): void }> & { stop: ReturnType<typeof vi.fn> }
  >,
}));
vi.mock("expo", () => ({ requireOptionalNativeModule: () => state.native }));
vi.mock("expo/fetch", () => ({
  fetch: (...args: unknown[]) => state.fetch(...args),
}));
vi.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device-only",
  getItemAsync: async (key: string) => state.storage.get(key) ?? null,
  setItemAsync: async (key: string, value: string, options: unknown) => {
    state.write(key, value, options);
    state.storage.set(key, value);
  },
}));
vi.mock("expo-crypto", async () => {
  const crypto = await import("node:crypto");
  return {
    randomUUID: crypto.randomUUID,
    CryptoDigestAlgorithm: { SHA256: "sha256" },
    CryptoEncoding: { BASE64: "base64" },
    digestStringAsync: async (_algorithm: string, value: string) =>
      crypto.createHash("sha256").update(value).digest("base64"),
  };
});
vi.mock("expo-web-browser", () => ({
  openBrowserAsync: (...args: unknown[]) => state.browser(...args),
}));
vi.mock("react-native", () => ({
  Platform: state.platform,
  AppState: {
    addEventListener: (...args: unknown[]) => state.appState(...args),
  },
}));
vi.mock("../../shared/ai/partyRunner.mjs", () => ({
  createBotRunner: (ports: typeof state.runnerPorts) => {
    state.runnerPorts = ports;
    return { setPaused: state.pause, startBotSeats: state.startSeats };
  },
}));

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "native-test",
  alg: "RS256",
};
const credentials = () => ({
  clientId: "oaiapp_test",
  subject: "subscriber",
  email: "user@example.invalid",
  accessToken: "private-access",
  refreshToken: "private-refresh",
  idToken: "private-id",
  expiresAt: Date.now() + 3600_000,
  scopes: ["resource.invoke", "chatgpt.tokens.use.direct"],
});
const join = {
  socketUrl: "http://localhost:1999",
  room: "room",
  tickets: ["signed-ticket"],
  model: "available",
  mode: "shared",
  personality: "varied",
  difficulty: "standard",
};
let authorizationUrl: URL | undefined;
let finish: ((value: { ok: boolean; url?: string }) => void) | undefined;
function authorize(url: string) {
  authorizationUrl = new URL(url);
  const callback = new URL("http://127.0.0.1:1234/auth/callback");
  callback.search = new URLSearchParams({
    state: authorizationUrl.searchParams.get("state")!,
    code: "one-time-code",
    client_id: "oaiapp_test",
  }).toString();
  finish?.({ ok: true, url: callback.href });
}
async function client(restore = true) {
  if (restore)
    state.storage.set(
      "mafia.chatgpt.credentials",
      JSON.stringify(credentials()),
    );
  const module = await import("./chatGPTRuntime.native");
  return module.getNativeChatGPTClient();
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.storage.clear();
  state.groups.length = 0;
  state.platform.OS = "android";
  authorizationUrl = undefined;
  finish = undefined;
  state.native = {
    start: vi.fn(async () => ({
      ok: true,
      id: "listener",
      redirectUri: "http://127.0.0.1:1234/auth/callback",
    })),
    callback: vi.fn(
      () =>
        new Promise<{ ok: boolean; url?: string }>((resolve) => {
          finish = resolve;
        }),
    ),
    stop: vi.fn(async () => {
      finish?.({ ok: false });
    }),
    open: vi.fn(async (url) => {
      authorize(url);
      return { ok: true };
    }),
    verify: async (input, signature, n, e) =>
      verify(
        "RSA-SHA256",
        Buffer.from(input),
        createPublicKey({ key: { kty: "RSA", n, e }, format: "jwk" }),
        Buffer.from(signature, "base64url"),
      ),
  };
  state.browser.mockImplementation(async (url: string) => {
    authorize(url);
    return { type: "opened" };
  });
  state.startSeats.mockImplementation((options: { tickets: string[] }) => {
    const group = Object.assign(
      options.tickets.map(() => ({ close: vi.fn() })),
      { stop: vi.fn() },
    );
    state.groups.push(group);
    return group;
  });
  state.fetch.mockImplementation(async (url: string, init: RequestInit) => {
    if (url.endsWith("jwks.json")) return Response.json({ keys: [jwk] });
    if (url.endsWith("/oauth/token")) {
      const form = new URLSearchParams(init.body as URLSearchParams);
      expect(form.get("client_id")).toBe("oaiapp_test");
      expect(form.has("client_secret")).toBe(false);
      expect(form.get("resource")).toBe("https://api.openai.com/v1");
      if (form.get("grant_type") === "authorization_code") {
        expect(
          createHash("sha256")
            .update(form.get("code_verifier")!)
            .digest("base64url"),
        ).toBe(authorizationUrl!.searchParams.get("code_challenge"));
      }
      const data = `${Buffer.from(JSON.stringify({ alg: "RS256", kid: jwk.kid })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "subscriber", email: "user@example.invalid", iss: "https://auth.openai.com", aud: "oaiapp_test", nonce: authorizationUrl?.searchParams.get("nonce"), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}`;
      return Response.json({
        access_token: "new-access",
        refresh_token: "new-refresh",
        id_token: `${data}.${sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`,
        token_type: "Bearer",
        expires_in: 3600,
        scope: "resource.invoke chatgpt.tokens.use.direct",
      });
    }
    if (url.endsWith("/models"))
      return Response.json({
        models: [
          { slug: "available", visibility: "list", display_name: "Available" },
          { slug: "hidden", visibility: "hide" },
        ],
      });
    if (url.endsWith("/responses"))
      return new Response(
        `data: ${JSON.stringify({ type: "response.completed", response: { output: [{ type: "message", content: [{ type: "output_text", text: "complete" }] }] } })}\n\n`,
      );
    return new Response(null, { status: 503 });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("React Native platform integration", () => {
  it.each(["cancel", "reject"])(
    "cancels an Android authorization when browser launch returns %s",
    async (kind) => {
      if (kind === "cancel")
        state.browser.mockResolvedValue({ type: "cancel" });
      else state.browser.mockRejectedValue(new Error("no browser"));
      const bridge = await client(false);
      await expect(
        bridge.connect(new AbortController().signal, vi.fn(), vi.fn()),
      ).rejects.toThrow();
      expect(state.native!.stop).toHaveBeenCalled();
      expect(state.storage.has("mafia.chatgpt.credentials")).toBe(false);
    },
  );
  it("fails safely when iOS cannot present its system browser", async () => {
    state.platform.OS = "ios";
    state.native!.open = vi.fn(async () => ({ ok: false }));
    const bridge = await client(false);
    await expect(
      bridge.connect(new AbortController().signal, vi.fn(), vi.fn()),
    ).rejects.toThrow();
    expect(state.native!.stop).toHaveBeenCalled();
    expect(state.browser).not.toHaveBeenCalled();
  });
  it("reports an absent iOS browser method without falling back to an external callback", async () => {
    state.platform.OS = "ios";
    state.native!.open = undefined;
    const bridge = await client(false);
    await expect(
      bridge.connect(new AbortController().signal, vi.fn(), vi.fn()),
    ).rejects.toThrow();
    expect(state.browser).not.toHaveBeenCalled();
    expect(state.native!.stop).toHaveBeenCalled();
  });
  it("fails safely when secure storage cannot save the installation identifier", async () => {
    state.write.mockImplementationOnce(() => {
      throw new Error("Keychain unavailable");
    });
    const bridge = await client(false);
    await expect(
      bridge.connect(new AbortController().signal, vi.fn(), vi.fn()),
    ).rejects.toThrow("Keychain unavailable");
    expect(state.native!.start).not.toHaveBeenCalled();
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("exposes cancellation and explicit usage recovery through the native service", async () => {
    const bridge = await client();
    const signal = new AbortController().signal;
    state.fetch.mockResolvedValue(
      Response.json(
        { error: { code: "subscription_sharing_usage_limit_exceeded" } },
        { status: 429 },
      ),
    );
    await expect(
      state.runnerPorts!.generate({ model: "available", input: "hi" }),
    ).rejects.toThrow();
    expect((await bridge.status(signal)).usagePaused).toBe(true);
    await expect(bridge.join(join, signal)).rejects.toThrow("ChatGPT plan");
    await bridge.retry(signal);
    expect((await bridge.status(signal)).usagePaused).toBe(false);
    await bridge.cancel(signal);
  });
  it("rejects corrupted stored credentials without silently erasing them", async () => {
    const bridge = await client(false);
    state.storage.set("mafia.chatgpt.credentials", "{invalid");
    await expect(bridge.status(new AbortController().signal)).rejects.toThrow();
    expect(state.storage.get("mafia.chatgpt.credentials")).toBe("{invalid");
    expect(state.fetch).not.toHaveBeenCalled();
  });
  it("fails clearly without the installed native module and makes no provider requests", async () => {
    state.native = null;
    const bridge = await client(false);
    await expect(bridge.status(new AbortController().signal)).rejects.toThrow(
      "installed Mafia app",
    );
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.browser).not.toHaveBeenCalled();
  });

  it.each(["android", "ios"])(
    "completes %s sign-in, verifies identity and persists only in device-only storage",
    async (platform) => {
      state.platform.OS = platform;
      const bridge = await client(false);
      const signal = new AbortController().signal;
      const account = await bridge.connect(signal, vi.fn(), vi.fn());
      expect(account).toMatchObject({
        connected: true,
        planEnabled: true,
        email: "user@example.invalid",
      });
      expect(account).not.toHaveProperty("accessToken");
      expect(
        JSON.parse(state.storage.get("mafia.chatgpt.credentials")!),
      ).toMatchObject({
        accessToken: "new-access",
        refreshToken: "new-refresh",
      });
      for (const call of state.write.mock.calls)
        expect(call[2]).toEqual({ keychainAccessible: "device-only" });
      expect(authorizationUrl!.searchParams.get("ext_agent_host_id")).toMatch(
        /^urn:uuid:/,
      );
      expect(
        platform === "ios" ? state.native!.open : state.browser,
      ).toHaveBeenCalledOnce();
      expect(
        platform === "ios" ? state.browser : state.native!.open,
      ).not.toHaveBeenCalled();
      vi.resetModules();
      expect((await (await client(false)).status(signal)).connected).toBe(true);
    },
  );

  it("restores models and streams inference using the stored OAuth grant", async () => {
    const bridge = await client();
    expect(await bridge.models(new AbortController().signal)).toEqual([
      { slug: "available", name: "Available" },
    ]);
    expect(
      await state.runnerPorts!.generate({ model: "available", input: "hello" }),
    ).toBe("complete");
    const [, request] = state.fetch.mock.calls.find(([url]) =>
      url.endsWith("/responses"),
    )!;
    expect(request.headers.authorization).toBe("Bearer private-access");
    expect(JSON.parse(request.body)).toMatchObject({
      store: false,
      stream: true,
    });
    expect(state.browser).not.toHaveBeenCalled();
  });

  it("validates game origin, path, model and plan before allocating local sockets", async () => {
    const bridge = await client();
    const signal = new AbortController().signal;
    for (const value of [
      { ...join, socketUrl: "https://attacker.example" },
      { ...join, socketUrl: "http://localhost:1999/path" },
      { ...join, model: "unknown" },
    ])
      await expect(bridge.join(value, signal)).rejects.toThrow();
    state.storage.set(
      "mafia.chatgpt.credentials",
      JSON.stringify({ ...credentials(), scopes: [] }),
    );
    await expect(bridge.join(join, signal)).rejects.toThrow("ChatGPT plan");
    expect(state.startSeats).not.toHaveBeenCalled();
  });

  it("joins seats locally, forwards foreground state and stops every group before disconnecting", async () => {
    const bridge = await client();
    const signal = new AbortController().signal;
    expect(await bridge.join(join, signal)).toEqual({ added: 1 });
    const [, onState] = state.appState.mock.calls[0];
    onState("background");
    onState("inactive");
    onState("active");
    expect(state.pause.mock.calls).toEqual([[true], [true], [false]]);
    expect(await bridge.disconnect(signal)).toEqual({
      remoteRevocationConfirmed: false,
    });
    expect(state.groups[0].stop).toHaveBeenCalledOnce();
    expect(
      JSON.parse(state.storage.get("mafia.chatgpt.credentials")!),
    ).not.toHaveProperty("accessToken");
  });

  it("does not create seats if disconnect wins a pending model request", async () => {
    const bridge = await client();
    const signal = new AbortController().signal;
    let release: (value: Response) => void = () => undefined;
    state.fetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const joining = bridge.join(join, signal);
    await vi.waitFor(() => expect(state.fetch).toHaveBeenCalled());
    // Revocation does not block this race test on an unrelated network request.
    state.storage.set(
      "mafia.chatgpt.credentials",
      JSON.stringify({ ...credentials(), refreshToken: null }),
    );
    await bridge.disconnect(signal);
    release(
      Response.json({ models: [{ slug: "available", visibility: "list" }] }),
    );
    await expect(joining).rejects.toThrow("changed");
    expect(state.startSeats).not.toHaveBeenCalled();
  });

  it("adapts native WebSocket message events and commands without Node transports", async () => {
    const events = new Map<string, (event: unknown) => void>();
    const send = vi.fn();
    const close = vi.fn();
    vi.stubGlobal(
      "WebSocket",
      class {
        readyState = 1;
        addEventListener(name: string, fn: (event: unknown) => void) {
          events.set(name, fn);
        }
        send = send;
        close = close;
      },
    );
    await client();
    const socket = new state.runnerPorts!.WebSocket("ws://localhost:1999");
    const receive = vi.fn();
    socket.on("message", receive);
    events.get("message")!({ data: "snapshot" });
    expect(receive).toHaveBeenCalledWith("snapshot");
    socket.send("command");
    socket.close();
    expect(send).toHaveBeenCalledWith("command");
    expect(close).toHaveBeenCalledExactlyOnceWith(1000, "Client disconnected");
    socket.close(1001, "App backgrounded");
    expect(close).toHaveBeenLastCalledWith(1001, "App backgrounded");
    expect(socket.readyState).toBe(1);
  });
});
