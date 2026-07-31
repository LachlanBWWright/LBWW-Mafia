import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "~/env";

export function createMobileToken(user: { id: string; name: string | null; handle: string | null; isAdmin: boolean }) {
  const payload = Buffer.from(JSON.stringify({ userId: user.id, name: user.name, handle: user.handle, isAdmin: user.isAdmin, exp: Date.now() + 30 * 24 * 60 * 60_000 })).toString("base64url");
  return `${payload}.${createHmac("sha256", env.BACKEND_SECRET).update(payload).digest("base64url")}`;
}
export function verifyMobileToken(token: string) {
  const [payload, signature] = token.split("."); if (!payload || !signature) return null;
  const expected = createHmac("sha256", env.BACKEND_SECRET).update(payload).digest("base64url"); const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { const value = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId: string; name?: string; handle?: string; isAdmin?: boolean; exp: number }; return value.exp > Date.now() ? value : null; } catch { return null; }
}
