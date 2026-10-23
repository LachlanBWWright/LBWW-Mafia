import { describe, it, expect, vi } from "vitest";
import {
  generateKeyPairSync,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import {
  createNativeAuthorization,
  nativeIdentityVerifier,
  type CallbackModule,
} from "./chatGPTAuthorization";

function fixture(patch: (url: URL) => void = () => {}) {
  let sequence = 0;
  let opened = "";
  let resolve: (value: { ok: boolean; url: string }) => void;
  const callback = new Promise<{ ok: boolean; url: string }>((done) => {
    resolve = done;
  });
  const native: CallbackModule = {
    start: vi.fn(async () => ({
      ok: true,
      id: "listener",
      redirectUri: "http://127.0.0.1:1234/auth/callback",
    })),
    callback: vi.fn(() => callback),
    stop: vi.fn(async () => {}),
    verify: vi.fn(async () => true),
  };
  const authorize = createNativeAuthorization({
    native,
    random: () => String(++sequence).padStart(64, "x"),
    challenge: async () => "pkce-hash",
    open: async (url) => {
      opened = url;
      const result = new URL("http://127.0.0.1:1234/auth/callback");
      result.search = new URLSearchParams({
        state: new URL(url).searchParams.get("state")!,
        code: "one-use-code",
        client_id: "oaiapp_test",
      }).toString();
      patch(result);
      resolve!({ ok: true, url: result.href });
    },
  });
  return { native, authorize, opened: () => opened };
}

describe("device-local ChatGPT authorization", () => {
  it.each([
    "not a URL",
    "https://127.0.0.1:1234/auth/callback",
    "http://localhost:1234/auth/callback",
    "http://127.0.0.1/auth/callback",
    "http://127.0.0.1:1234/callback",
    "http://user:pass@127.0.0.1:1234/auth/callback",
    "http://127.0.0.1:1234/auth/callback?q=1",
    "http://127.0.0.1:1234/auth/callback#fragment",
  ])("closes invalid native callback listener %s", async (redirectUri) => {
    const { native, authorize } = fixture();
    vi.mocked(native.start).mockResolvedValue({
      ok: true,
      id: "listener",
      redirectUri,
    });
    await expect(
      authorize({ hostId: "host", registration: null, reconsent: false }),
    ).rejects.toThrow("callback address");
    expect(native.stop).toHaveBeenCalledWith("listener");
    expect(native.callback).not.toHaveBeenCalled();
  });
  it("reuses registration and account hints and requests consent only for explicit enablement", async () => {
    const { authorize, opened } = fixture((url) =>
      url.searchParams.delete("client_id"),
    );
    const transaction = await authorize({
      hostId: "saved-host",
      registration: {
        clientId: "oaiapp_test",
        idToken: "identity-hint",
        email: "user@example.invalid",
      },
      reconsent: true,
    });
    expect(await transaction.result).toEqual({
      code: "one-use-code",
      clientId: "oaiapp_test",
    });
    const url = new URL(opened());
    expect(url.searchParams.get("client_id")).toBe("oaiapp_test");
    expect(url.searchParams.get("id_token_hint")).toBe("identity-hint");
    expect(url.searchParams.get("login_hint")).toBe("user@example.invalid");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.has("agent_name_hint")).toBe(false);
    expect(url.searchParams.get("state")).not.toBe(transaction.nonce);
    expect(transaction.nonce).not.toBe(transaction.verifier);
  });
  it.each([
    "missing-code",
    "oversized-code",
    "missing-client",
    "dynamic-client",
    "duplicate-state",
    "wrong-path",
    "fragment",
  ])("rejects incomplete or ambiguous callback %s", async (kind) => {
    const { authorize } = fixture((url) => {
      if (kind === "missing-code") url.searchParams.delete("code");
      if (kind === "oversized-code")
        url.searchParams.set("code", "x".repeat(4097));
      if (kind === "missing-client") url.searchParams.delete("client_id");
      if (kind === "dynamic-client")
        url.searchParams.set("client_id", "dynamic_agent_client");
      if (kind === "duplicate-state")
        url.searchParams.append("state", "duplicate");
      if (kind === "wrong-path") url.pathname = "/wrong";
      if (kind === "fragment") url.hash = "unexpected";
    });
    expect(
      await (
        await authorize({
          hostId: "host",
          registration: null,
          reconsent: false,
        })
      ).result,
    ).toHaveProperty("error");
  });
  it("cleans up listener failures and callback rejection without returning authorization success", async () => {
    const { native, authorize } = fixture();
    vi.mocked(native.start).mockResolvedValueOnce({ ok: false });
    await expect(
      authorize({ hostId: "host", registration: null, reconsent: false }),
    ).rejects.toThrow("Could not start");
    vi.mocked(native.callback).mockRejectedValueOnce(
      new Error("native listener closed"),
    );
    expect(
      await (
        await authorize({
          hostId: "host",
          registration: null,
          reconsent: false,
        })
      ).result,
    ).toHaveProperty("error");
    expect(native.stop).toHaveBeenCalledWith("listener");
  });
  it("starts a native listener and sends the exact callback with PKCE, without a secret", async () => {
    const { authorize, native, opened } = fixture();
    const transaction = await authorize({
      hostId: "urn:uuid:device",
      registration: null,
      reconsent: false,
    });
    expect(await transaction.result).toEqual({
      code: "one-use-code",
      clientId: "oaiapp_test",
    });
    const url = new URL(opened());
    expect(url.searchParams.get("redirect_uri")).toBe(transaction.redirectUri);
    expect(url.searchParams.get("client_id")).toBe("dynamic_agent_client");
    expect(url.searchParams.get("code_challenge")).toBe("pkce-hash");
    expect(url.searchParams.has("client_secret")).toBe(false);
    expect(native.stop).toHaveBeenCalledWith("listener");
  });
  it.each(["state", "client", "duplicate", "origin", "denied"])(
    "rejects invalid %s callbacks and closes the listener",
    async (kind) => {
      const { authorize, native } = fixture((url) => {
        if (kind === "state") url.searchParams.set("state", "wrong");
        if (kind === "client")
          url.searchParams.set("client_id", "oaiapp_other");
        if (kind === "duplicate") url.searchParams.append("code", "duplicate");
        if (kind === "origin") url.hostname = "attacker.example";
        if (kind === "denied") url.searchParams.set("error", "access_denied");
      });
      const transaction = await authorize({
        hostId: "device",
        registration: { clientId: "oaiapp_test" },
        reconsent: false,
      });
      expect(await transaction.result).toHaveProperty("error");
      expect(native.stop).toHaveBeenCalled();
    },
  );
  it("uses native RSA verification and rejects forged identity, nonce, audience and dates", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const key = {
      ...publicKey.export({ format: "jwk" }),
      kid: "test",
      alg: "RS256",
    };
    const { native } = fixture();
    native.verify = async (input, signature, n, e) =>
      verify(
        "RSA-SHA256",
        Buffer.from(input),
        createPublicKey({ key: { kty: "RSA", n, e }, format: "jwk" }),
        Buffer.from(signature, "base64url"),
      );
    const identity = nativeIdentityVerifier(native);
    const now = Date.now();
    const claims = {
      sub: "user",
      iss: "https://auth.openai.com",
      aud: "oaiapp_test",
      nonce: "nonce",
      exp: Math.floor(now / 1000) + 300,
      iat: Math.floor(now / 1000),
    };
    const token = (patch = {}) => {
      const unsigned = `${Buffer.from(JSON.stringify({ alg: "RS256", kid: "test" })).toString("base64url")}.${Buffer.from(JSON.stringify({ ...claims, ...patch })).toString("base64url")}`;
      return `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url")}`;
    };
    const request = (async () =>
      Response.json({ keys: [key] })) as typeof fetch;
    await expect(
      identity(token(), "oaiapp_test", "nonce", request, now),
    ).resolves.toMatchObject({ sub: "user" });
    await expect(
      identity(
        token({ aud: ["oaiapp_test", "other"], azp: "oaiapp_test" }),
        "oaiapp_test",
        "nonce",
        request,
        now,
      ),
    ).resolves.toMatchObject({ sub: "user" });
    for (const patch of [
      { nonce: "wrong" },
      { aud: "other" },
      { exp: 1 },
      { iss: "https://attacker.example" },
      { sub: "" },
      { sub: 12 },
      { exp: undefined },
      { exp: "future" },
      { exp: 1e400 },
      { iat: undefined },
      { iat: Math.floor(now / 1000) + 61 },
      { nbf: Math.floor(now / 1000) + 61 },
      { aud: ["oaiapp_test", "other"] },
      { azp: "other" },
    ])
      await expect(
        identity(token(patch), "oaiapp_test", "nonce", request, now),
      ).rejects.toThrow();
    const forged = `${token().slice(0, -12)}AAAAAAAAAAAA`;
    await expect(
      identity(forged, "oaiapp_test", "nonce", request, now),
    ).rejects.toThrow();
    for (const malformed of [
      "",
      "x".repeat(32001),
      "header.payload",
      "a.b.c.extra",
      "!.!.!",
      `${Buffer.from('{"alg":"none"}').toString("base64url")}.e30.signature`,
    ])
      await expect(
        identity(malformed, "oaiapp_test", "nonce", request, now),
      ).rejects.toThrow();
    for (const invalidKey of [
      { ...key, kid: "wrong" },
      { ...key, use: "enc" },
      { ...key, alg: "RS512" },
      { ...key, kty: "EC" },
      { ...key, n: undefined },
    ])
      await expect(
        identity(
          token(),
          "oaiapp_test",
          "nonce",
          (async () => Response.json({ keys: [invalidKey] })) as typeof fetch,
          now,
        ),
      ).rejects.toThrow();
    await expect(
      identity(
        token(),
        "oaiapp_test",
        "nonce",
        (async () => new Response(null, { status: 503 })) as typeof fetch,
        now,
      ),
    ).rejects.toThrow();
  });
});
