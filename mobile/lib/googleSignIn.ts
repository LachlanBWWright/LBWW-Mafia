import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
WebBrowser.maybeCompleteAuthSession();
const base =
  process.env.EXPO_PUBLIC_TRPC_URL?.replace(/\/api\/trpc$/, "") ??
  "http://localhost:3000";
const redirect = "mernmafia://auth";
export type GoogleSession = {
  token: string;
  refreshToken: string;
  sessionId: string;
  user: {
    id: string;
    name: string | null;
    handle: string | null;
    isAdmin: boolean;
  };
};
async function post(path: string, body: unknown) {
  const response = await fetch(`${base}/api/account/mobile-google/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 503)
    throw new Error("Google sign-in is unavailable right now.");
  if (!response.ok) throw new Error("Unable to sign in. Try again.");
  return response;
}
export async function signInWithGoogle(): Promise<GoogleSession | null> {
  // Two UUIDs provide 244 random bits without relying on browser-only randomness.
  const verifier = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(
    /-/g,
    "",
  );
  const challenge = (
    await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 },
    )
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const { state } = (await (await post("start", { challenge })).json()) as {
    state: string;
  };
  const result = await WebBrowser.openAuthSessionAsync(
    `${base}/mobile-google?state=${encodeURIComponent(state)}`,
    redirect,
  );
  if (result.type !== "success") return null;
  const callback = new URL(result.url);
  if (
    `${callback.protocol}//${callback.host}` !== redirect ||
    callback.searchParams.get("state") !== state
  )
    throw new Error("Invalid sign-in response. Try again.");
  const code = callback.searchParams.get("code");
  if (!code) throw new Error("Sign-in did not complete. Try again.");
  return (await (
    await post("exchange", { state, code, verifier })
  ).json()) as GoogleSession;
}
