type GameIdentity = { userId: string; handle?: string };

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Verifies the short-lived game ticket without importing Node-only crypto APIs. */
export async function verifyPartykitGameIdentity(
  token: string | undefined,
  secret: unknown,
): Promise<GameIdentity | undefined> {
  if (typeof secret !== "string" || !token) return undefined;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return undefined;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(signature),
      new TextEncoder().encode(encodedPayload),
    );
    if (!valid) return undefined;

    const value = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedPayload)),
    ) as { userId?: unknown; handle?: unknown; exp?: unknown };
    if (
      typeof value.userId !== "string" ||
      typeof value.exp !== "number" ||
      value.exp < Date.now()
    ) {
      return undefined;
    }
    return {
      userId: value.userId,
      handle: typeof value.handle === "string" ? value.handle : undefined,
    };
  } catch {
    return undefined;
  }
}
