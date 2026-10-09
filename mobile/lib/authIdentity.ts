/** A navigation identity only; the server verifies the token's signature and session. */
export function authIdentity(token: string | null): string {
  if (!token) return "signed-out";
  try {
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return "signed-out";
    const encoded = parts[0].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
    const json = decodeURIComponent(
      Array.from(
        binary,
        (character) =>
          `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
      ).join(""),
    );
    const payload: unknown = JSON.parse(json);
    if (
      !payload ||
      typeof payload !== "object" ||
      !("sub" in payload) ||
      typeof payload.sub !== "string" ||
      !payload.sub.trim()
    )
      return "signed-out";
    return `account:${payload.sub}`;
  } catch {
    return "signed-out";
  }
}
