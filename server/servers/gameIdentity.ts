import { createHmac, timingSafeEqual } from "node:crypto";
import { avatarPresets } from "@mernmafia/shared/trpc/accountFeatures";

export function verifyGameIdentity(token: string | undefined): { userId: string; handle?: string; avatarPreset?: string } | undefined {
  const secret = process.env.BACKEND_SECRET;
  if (!secret || !token) return undefined;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return undefined;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: unknown; handle?: unknown; avatarPreset?: unknown; exp?: unknown };
    if (typeof value.userId !== "string" || typeof value.exp !== "number" || value.exp < Date.now()) return undefined;
    return { userId: value.userId, handle: typeof value.handle === "string" ? value.handle : undefined, ...(typeof value.avatarPreset === "string" && avatarPresets.some((preset) => preset === value.avatarPreset) ? { avatarPreset: value.avatarPreset } : {}) };
  } catch { return undefined; }
}
