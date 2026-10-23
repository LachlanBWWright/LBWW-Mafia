import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-crypto", () => ({
  randomUUID: () => "12345678-1234-4234-8234-123456789abc",
  digestStringAsync: async () => "challenge",
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  CryptoEncoding: { BASE64: "base64" },
}));
vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
}));
import { openAuthSessionAsync } from "expo-web-browser";
import { signInWithGoogle } from "./googleSignIn";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("mobile Google sign-in availability", () => {
  it("reports unavailable sign-in without opening the browser", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    await expect(signInWithGoogle()).rejects.toThrow(
      "Google sign-in is unavailable right now.",
    );
    expect(openAuthSessionAsync).not.toHaveBeenCalled();
  });
});
