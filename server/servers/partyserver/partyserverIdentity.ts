type GameIdentity = { userId?: string; handle?: string; botSeat?: boolean };

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
export async function verifyPartyServerGameIdentity(
  token: string | undefined,
  secret: unknown,
): Promise<GameIdentity | undefined> {
  if (typeof secret !== "string" || !token) return undefined;
  const parts = token.split(".");
  if (parts.length !== 2) return undefined;
  const [encodedPayload, signature] = parts;
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
    ) as { userId?: unknown; handle?: unknown; botSeat?: unknown; guest?: unknown; exp?: unknown };
    if (
      (typeof value.userId !== "string" && !(value.botSeat === true && value.guest === true)) ||
      typeof value.exp !== "number" ||
      !Number.isFinite(value.exp) ||
      value.exp <= Date.now()
    ) {
      return undefined;
    }
    return {
      userId: typeof value.userId === "string" ? value.userId : undefined,
      handle: typeof value.handle === "string" ? value.handle : undefined,
      ...(value.botSeat === true ? { botSeat: true } : {}),
    };
  } catch {
    return undefined;
  }
}
