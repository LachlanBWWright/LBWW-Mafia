import * as SecureStore from "expo-secure-store";
import { getAuthToken, setAuthToken } from "./authToken";
import { persistAuthToken } from "./authStorage";
type Credentials = { token: string; refreshToken: string; sessionId: string };
const KEY = "lbww-mobile-session";
const base =
  process.env.EXPO_PUBLIC_TRPC_URL?.replace(/\/api\/trpc$/, "") ??
  "http://localhost:3000";
let credentials: Credentials | undefined;
let writes = Promise.resolve();
let revision = 0;
let refreshing: Promise<string | null> | undefined;
export async function saveMobileSession(value: Credentials) {
  const current = ++revision;
  credentials = value;
  writes = writes
    .catch(() => undefined)
    .then(async () => {
      if (revision !== current) return;
      await SecureStore.setItemAsync(KEY, JSON.stringify(value));
      await persistAuthToken(value.token);
    });
  await writes;
}
export function clearMobileSession() {
  revision++;
  const previous = credentials;
  const restored = previous
    ? Promise.resolve(previous)
    : SecureStore.getItemAsync(KEY)
        .then((value) =>
          value ? (JSON.parse(value) as Credentials) : undefined,
        )
        .catch(() => undefined);
  credentials = undefined;
  writes = writes
    .catch(() => undefined)
    .then(async () => {
      const saved = await restored;
      await SecureStore.deleteItemAsync(KEY);
      if (saved)
        void fetch(`${base}/api/account/mobile-logout`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken: saved.refreshToken }),
          signal: AbortSignal.timeout(10_000),
        }).catch(() => undefined);
    });
  return writes;
}
async function refresh() {
  const started = revision;
  const previousToken = getAuthToken();
  if (!previousToken) return null;
  const stored =
    credentials ??
    (JSON.parse(
      (await SecureStore.getItemAsync(KEY)) ?? "null",
    ) as Credentials | null);
  if (!stored || revision !== started || getAuthToken() !== previousToken)
    return null;
  const response = await fetch(`${base}/api/account/mobile-refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: stored.refreshToken }),
    signal: AbortSignal.timeout(10_000),
  });
  if (revision !== started || getAuthToken() !== previousToken) return null;
  if (response.status === 401) {
    setAuthToken(null);
    await persistAuthToken(null);
    await clearMobileSession();
    return null;
  }
  if (!response.ok) throw new Error("Unable to refresh session");
  const next = (await response.json()) as Credentials;
  if (revision !== started || getAuthToken() !== previousToken) return null;
  await saveMobileSession(next);
  // Signing out while SecureStore was writing must win over a late refresh.
  if (getAuthToken() !== previousToken) return null;
  setAuthToken(next.token);
  return next.token;
}
function expiresSoon(token: string) {
  try {
    const payload = JSON.parse(
      atob(token.split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp: number };
    return payload.exp < Date.now() + 30_000;
  } catch {
    return true;
  }
}
export async function getAccessToken() {
  const token = getAuthToken();
  if (!token || !expiresSoon(token)) return token;
  refreshing ??= refresh().finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("authorization", `Bearer ${token}`);
  else headers.delete("authorization");
  const response = await fetch(input, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });
  if (response.status !== 401 || !token || getAuthToken() !== token)
    return response;
  refreshing ??= refresh().finally(() => {
    refreshing = undefined;
  });
  const next = await refreshing;
  if (!next) return response;
  headers.set("authorization", `Bearer ${next}`);
  return fetch(input, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });
}
