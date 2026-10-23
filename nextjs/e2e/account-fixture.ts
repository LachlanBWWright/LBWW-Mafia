// Local database provisioning keeps test credentials out of production auth routes.
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
export async function createAccountFixture(name = "Lobby owner") {
  const client = postgres(
    process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:5432/mernmafia",
    { max: 1 },
  );
  try {
    const id = randomUUID(),
      sessionId = randomUUID(),
      refreshToken = randomBytes(32).toString("base64url"),
      now = Date.now();
    const email = `${id}@test.invalid`,
      handle = `test_${id.replace(/-/g, "").slice(0, 18)}`;
    await client`insert into nextjs_user (id, email, name, handle) values (${id}, ${email}, ${name}, ${handle})`;
    const refreshHash = createHash("sha256").update(refreshToken).digest("hex"),
      expiry = new Date(now + 60 * 60_000);
    await client`insert into nextjs_mobile_session (id, user_id, refresh_hash, auth_version, device_name, expires_at) values (${sessionId}, ${id}, ${refreshHash}, 0, 'Browser test', ${expiry})`;
    const secret =
      process.env.MOBILE_AUTH_SECRET ??
      createHmac("sha256", process.env.AUTH_SECRET ?? "playwright-test-secret")
        .update("mafia-mobile-access-v1")
        .digest("hex");
    const payload = Buffer.from(
      JSON.stringify({
        sub: id,
        kind: "mobile",
        iat: now,
        exp: now + 15 * 60_000,
        sessionId,
        authVersion: 0,
      }),
    ).toString("base64url");
    return {
      id,
      token: `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`,
    };
  } finally {
    await client.end();
  }
}
