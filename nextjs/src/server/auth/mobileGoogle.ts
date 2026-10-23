import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { mobileOauthRequests } from "@mernmafia/db/schema";
import { db } from "~/server/db";
export const mobileRedirect = "mernmafia://auth";
export const oauthHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const pkceChallenge = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
export async function startMobileGoogle(challenge: string) {
  const id = randomBytes(32).toString("base64url");
  await db
    .delete(mobileOauthRequests)
    .where(lt(mobileOauthRequests.expiresAt, new Date()));
  await db
    .insert(mobileOauthRequests)
    .values({ id, challenge, expiresAt: new Date(Date.now() + 5 * 60_000) });
  return id;
}
export async function bindMobileBrowser(id: string, secret: string) {
  const [request] = await db
    .update(mobileOauthRequests)
    .set({ browserHash: oauthHash(secret) })
    .where(
      and(
        eq(mobileOauthRequests.id, id),
        isNull(mobileOauthRequests.browserHash),
        gt(mobileOauthRequests.expiresAt, new Date()),
      ),
    )
    .returning();
  return !!request;
}
export async function completeMobileGoogle(
  id: string,
  browserSecret: string,
  userId: string,
) {
  const code = randomBytes(32).toString("base64url");
  const [request] = await db
    .update(mobileOauthRequests)
    .set({ userId, codeHash: oauthHash(code) })
    .where(
      and(
        eq(mobileOauthRequests.id, id),
        eq(mobileOauthRequests.browserHash, oauthHash(browserSecret)),
        isNull(mobileOauthRequests.codeHash),
        gt(mobileOauthRequests.expiresAt, new Date()),
      ),
    )
    .returning();
  return request ? code : null;
}
export async function consumeMobileGoogle(
  id: string,
  code: string,
  verifier: string,
) {
  const [request] = await db
    .delete(mobileOauthRequests)
    .where(
      and(
        eq(mobileOauthRequests.id, id),
        eq(mobileOauthRequests.codeHash, oauthHash(code)),
        eq(mobileOauthRequests.challenge, pkceChallenge(verifier)),
        gt(mobileOauthRequests.expiresAt, new Date()),
      ),
    )
    .returning();
  return request?.userId ?? null;
}
