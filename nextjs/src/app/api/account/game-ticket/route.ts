import { getActiveIdentity } from "~/server/auth/identity";
import { verifyMobileToken } from "~/server/auth/mobileToken";
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { env } from "~/env";

export async function GET(request: Request) {
  const session = await auth();
  const bearer = request.headers.get("authorization");
  const mobile = bearer?.startsWith("Bearer ")
    ? await verifyMobileToken(bearer.slice(7))
    : null;
  const userId = session?.user?.id ?? mobile?.sub;
  const identity = userId ? await getActiveIdentity(userId) : null;
  if (!identity) return NextResponse.json({ token: null });
  const payload = Buffer.from(
    JSON.stringify({
      userId: identity.id,
      handle: identity.handle ?? identity.name ?? undefined,
      exp: Date.now() + 60_000,
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", env.BACKEND_SECRET)
    .update(payload)
    .digest("base64url");
  return NextResponse.json({ token: `${payload}.${signature}` });
}
