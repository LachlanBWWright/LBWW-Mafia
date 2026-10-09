import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { mobileSessions, users } from "@mernmafia/db/schema";
import { AuthClaimsSchema } from "@mernmafia/shared/auth";
import { db } from "~/server/db";
import { env } from "~/env";
const accessLifetime = 15 * 60_000;
const sessionLifetime = 30 * 24 * 60 * 60_000;
// Domain separation prevents a mobile credential from authenticating as the backend.
const secret = () =>
  env.MOBILE_AUTH_SECRET ??
  createHmac("sha256", env.AUTH_SECRET ?? "local-development-auth")
    .update("mafia-mobile-access-v1")
    .digest("hex");
const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
function access(userId: string, sessionId: string, authVersion: number) {
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      kind: "mobile",
      iat: now,
      exp: now + accessLifetime,
      sessionId,
      authVersion,
    }),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export async function createMobileSession(
  user: { id: string; passwordHash?: string | null },
  deviceName = "Mobile device",
) {
  const [account] = await db.select().from(users).where(eq(users.id, user.id));
  if (
    (user.passwordHash !== undefined &&
      user.passwordHash !== account?.passwordHash) ||
    !account?.id ||
    account.accountStatus !== "active" ||
    account.deletedAt
  )
    throw new Error("Account unavailable");
  const id = randomUUID(),
    refreshToken = randomBytes(32).toString("base64url");
  await db.insert(mobileSessions).values({
    id,
    userId: user.id,
    refreshHash: hash(refreshToken),
    authVersion: account.authVersion,
    deviceName: deviceName.slice(0, 80),
    expiresAt: new Date(Date.now() + sessionLifetime),
  });
  return {
    token: access(user.id, id, account.authVersion),
    refreshToken,
    sessionId: id,
  };
}
/** Compatibility helper for tests and internal callers; production login returns refresh credentials too. */
export async function createMobileToken(user: { id: string }) {
  return (await createMobileSession(user)).token;
}
function decodeMobileToken(token: string) {
  if (token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts as [string, string];
  const expected = createHmac("sha256", secret())
    .update(payload)
    .digest("base64url");
  const a = Buffer.from(signature),
    b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const raw = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as Record<string, unknown>;
    const value = AuthClaimsSchema.parse(raw);
    if (
      value.kind !== "mobile" ||
      value.exp <= Date.now() ||
      value.iat > Date.now() + 60_000 ||
      typeof raw.sessionId !== "string"
    )
      return null;
    return { ...value, sessionId: raw.sessionId };
  } catch {
    return null;
  }
}
export async function verifyMobileToken(token: string) {
  const value = decodeMobileToken(token);
  if (!value) return null;
  const [session] = await db
    .select({ id: mobileSessions.id })
    .from(mobileSessions)
    .innerJoin(users, eq(users.id, mobileSessions.userId))
    .where(
      and(
        eq(mobileSessions.id, value.sessionId),
        eq(mobileSessions.userId, value.sub),
        isNull(mobileSessions.revokedAt),
        gt(mobileSessions.expiresAt, new Date()),
        eq(mobileSessions.authVersion, users.authVersion),
        eq(users.accountStatus, "active"),
        isNull(users.deletedAt),
      ),
    );
  return session ? value : null;
}
export async function refreshMobileSession(refreshToken: string) {
  if (refreshToken.length > 128) return null;
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(mobileSessions)
      .where(eq(mobileSessions.refreshHash, hash(refreshToken)));
    if (!candidate) return null;
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, candidate.userId))
      .for("update");
    const [session] = await tx
      .select()
      .from(mobileSessions)
      .where(eq(mobileSessions.refreshHash, hash(refreshToken)))
      .for("update");
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    )
      return null;
    if (
      !user ||
      user.deletedAt ||
      user.accountStatus !== "active" ||
      user.authVersion !== session.authVersion
    )
      return null;
    const next = randomBytes(32).toString("base64url");
    await tx
      .update(mobileSessions)
      .set({ refreshHash: hash(next) })
      .where(eq(mobileSessions.id, session.id));
    return {
      token: access(user.id, session.id, user.authVersion),
      refreshToken: next,
      sessionId: session.id,
    };
  });
}
export async function revokeMobileSession(refreshToken: string) {
  await db
    .update(mobileSessions)
    .set({ revokedAt: new Date() })
    .where(eq(mobileSessions.refreshHash, hash(refreshToken)));
}
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const { hashPassword, verifyPassword } = await import("./password");
  const newHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    if (
      !user?.passwordHash ||
      !(await verifyPassword(currentPassword, user.passwordHash))
    )
      throw new Error("Current password is incorrect.");
    await tx
      .update(users)
      .set({
        passwordHash: newHash,
        authVersion: sql`${users.authVersion} + 1`,
      })
      .where(eq(users.id, userId));
    await tx
      .update(mobileSessions)
      .set({ revokedAt: new Date() })
      .where(eq(mobileSessions.userId, userId));
  });
}

export async function listDeviceSessions(userId: string) {
  return db
    .select({
      id: mobileSessions.id,
      deviceName: mobileSessions.deviceName,
      createdAt: mobileSessions.createdAt,
    })
    .from(mobileSessions)
    .where(
      and(
        eq(mobileSessions.userId, userId),
        isNull(mobileSessions.revokedAt),
        gt(mobileSessions.expiresAt, new Date()),
      ),
    );
}
export async function revokeDeviceSession(userId: string, sessionId: string) {
  await db
    .update(mobileSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(mobileSessions.userId, userId), eq(mobileSessions.id, sessionId)),
    );
}
