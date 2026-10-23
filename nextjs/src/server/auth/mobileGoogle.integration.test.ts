import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users, userRoles, mobileOauthRequests } from "@mernmafia/db/schema";
import { db } from "~/server/db";
import { POST as exchange } from "~/app/api/account/mobile-google/exchange/route";
import {
  startMobileGoogle,
  bindMobileBrowser,
  completeMobileGoogle,
  consumeMobileGoogle,
  pkceChallenge,
} from "./mobileGoogle";
const userId = `google-${crypto.randomUUID()}`,
  verifier = "a".repeat(64);
beforeAll(async () => {
  await db
    .insert(users)
    .values({ id: userId, email: `${userId}@test.invalid` });
});
afterAll(async () => {
  await db
    .delete(mobileOauthRequests)
    .where(eq(mobileOauthRequests.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await db.$client.end({ timeout: 1 });
});
describe("native Google sign-in exchange", () => {
  it("binds one browser and requires the correct code and PKCE verifier exactly once", async () => {
    const state = await startMobileGoogle(pkceChallenge(verifier));
    expect(await bindMobileBrowser(state, "browser-secret")).toBe(true);
    expect(await bindMobileBrowser(state, "another-browser")).toBe(false);
    expect(
      await completeMobileGoogle(state, "another-browser", userId),
    ).toBeNull();
    const code = await completeMobileGoogle(state, "browser-secret", userId);
    expect(code).not.toBeNull();
    expect(
      await completeMobileGoogle(state, "browser-secret", userId),
    ).toBeNull();
    expect(await consumeMobileGoogle(state, "wrong-code", verifier)).toBeNull();
    expect(
      await consumeMobileGoogle(state, code!, "wrong-verifier"),
    ).toBeNull();
    const exchanges = await Promise.all([
      consumeMobileGoogle(state, code!, verifier),
      consumeMobileGoogle(state, code!, verifier),
    ]);
    expect(exchanges.filter(Boolean)).toEqual([userId]);
  });
  it("rejects expired exchanges", async () => {
    const state = await startMobileGoogle(pkceChallenge(verifier));
    await bindMobileBrowser(state, "browser-secret");
    const code = await completeMobileGoogle(state, "browser-secret", userId);
    await db
      .update(mobileOauthRequests)
      .set({ expiresAt: new Date(0) })
      .where(eq(mobileOauthRequests.id, state));
    expect(await consumeMobileGoogle(state, code!, verifier)).toBeNull();
    await db
      .delete(mobileOauthRequests)
      .where(eq(mobileOauthRequests.id, state));
  });
  it("returns canonical administrator privileges on a fresh native sign-in", async () => {
    await db
      .update(users)
      .set({
        isAdmin: false,
        name: "Role administrator",
        handle: `admin_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
      })
      .where(eq(users.id, userId));
    await db.insert(userRoles).values({ userId, role: "administrator" });
    const state = await startMobileGoogle(pkceChallenge(verifier));
    await bindMobileBrowser(state, "admin-browser");
    const code = await completeMobileGoogle(state, "admin-browser", userId);
    const response = await exchange(
      new Request("http://test/api/account/mobile-google/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, code, verifier }),
      }),
    );
    expect(response.status).toBe(200);
    const session = (await response.json()) as {
      user: { id: string; name: string; isAdmin: boolean };
      token: string;
      refreshToken: string;
    };
    expect(session.user).toMatchObject({
      id: userId,
      name: "Role administrator",
      isAdmin: true,
    });
    expect(session.token).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    const [stored] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId));
    expect(stored?.isAdmin).toBe(false);
  });
});
