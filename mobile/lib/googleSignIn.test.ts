import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("expo-crypto", () => ({
  randomUUID: () => "12345678-1234-4234-a234-123456789abc",
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  CryptoEncoding: { BASE64: "BASE64" },
  digestStringAsync: vi.fn(async () => "abcd+/=="),
}));
vi.mock("expo-web-browser", () => ({
  WebBrowserResultType: { CANCEL: "cancel" },
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
}));
import { openAuthSessionAsync, WebBrowserResultType } from "expo-web-browser";
import { signInWithGoogle } from "./googleSignIn";
const state = "a".repeat(43),
  code = "b".repeat(43);
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ state })),
  );
});
describe("Google browser handoff", () => {
  it("does not exchange when the user cancels", async () => {
    vi.mocked(openAuthSessionAsync).mockResolvedValue({
      type: WebBrowserResultType.CANCEL,
    });
    expect(await signInWithGoogle()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("rejects a callback from another sign-in attempt", async () => {
    vi.mocked(openAuthSessionAsync).mockResolvedValue({
      type: "success",
      url: `mernmafia://auth?state=other&code=${code}`,
    });
    await expect(signInWithGoogle()).rejects.toThrow(
      "Invalid sign-in response",
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("exchanges a matching code using the private verifier", async () => {
    vi.mocked(openAuthSessionAsync).mockResolvedValue({
      type: "success",
      url: `mernmafia://auth?state=${state}&code=${code}`,
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ state }))
      .mockResolvedValueOnce(
        Response.json({
          token: "access",
          refreshToken: "refresh",
          sessionId: "device",
        }),
      );
    expect(await signInWithGoogle()).toMatchObject({ token: "access" });
    const request = JSON.parse(
      vi.mocked(fetch).mock.calls[1]![1]!.body as string,
    ) as { verifier: string; state: string; code: string };
    expect(request).toMatchObject({ state, code });
    expect(request.verifier).toHaveLength(64);
    expect(vi.mocked(openAuthSessionAsync).mock.calls[0]![0]).not.toContain(
      request.verifier,
    );
  });
});
