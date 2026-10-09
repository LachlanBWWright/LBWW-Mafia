import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "~/server/db";
import { requestLimits } from "@mernmafia/db/schema";
import { env } from "~/env";
export async function consumeLimit(
  scope: string,
  maximum: number,
  windowMs = 60_000,
) {
  const key = createHash("sha256").update(scope).digest("hex");
  const result = await db.execute(sql`
    insert into ${requestLimits} (key, window_start, hits) values (${key}, now(), 1)
    on conflict (key) do update set
      hits = case when ${requestLimits.windowStart} <= now() - (${windowMs} * interval '1 millisecond') then 1 else ${requestLimits.hits} + 1 end,
      window_start = case when ${requestLimits.windowStart} <= now() - (${windowMs} * interval '1 millisecond') then now() else ${requestLimits.windowStart} end
    returning hits`);
  return Number(result[0]?.hits) <= maximum;
}
export async function guardRequest(
  request: Request,
  scope: string,
  maximum: number,
) {
  // Only trust a deployment-controlled header; clients must not choose their bucket.
  const address = env.TRUSTED_CLIENT_IP_HEADER
    ? (request.headers.get(env.TRUSTED_CLIENT_IP_HEADER) ?? "anonymous")
    : "anonymous";
  if (!(await consumeLimit(`${scope}:${address.slice(0, 128)}`, maximum))) {
    return Response.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  return null;
}
export async function readJson(
  request: Request,
  maximum = 16_384,
): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maximum)
    throw new Error("Request too large");
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0,
    value = "";
  const decoder = new TextDecoder();
  let timedOut = false;
  const expiry = setTimeout(() => {
    timedOut = true;
    void reader.cancel();
  }, 10_000);
  try {
    for (;;) {
      const { value: bytes, done } = await reader.read();
      if (timedOut) throw new Error("Request body timed out");
      if (done) break;
      size += bytes.byteLength;
      if (size > maximum) throw new Error("Request too large");
      value += decoder.decode(bytes, { stream: true });
    }
    return JSON.parse(value + decoder.decode());
  } finally {
    clearTimeout(expiry);
    await reader.cancel().catch(() => undefined);
  }
}
