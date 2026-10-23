import { getActiveIdentity } from "~/server/auth/identity";
import { verifyMobileToken } from "~/server/auth/mobileToken";
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { env } from "~/env";
import { guardRequest, readJson } from "~/server/reliability/requests";

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

export async function POST(request: Request) {
  const limited = await guardRequest(request, "ai-character-seats", 12);
  if (limited) return limited;
  const session = await auth();
  const bearer = request.headers.get("authorization");
  const mobile = bearer?.startsWith("Bearer ")
    ? await verifyMobileToken(bearer.slice(7))
    : null;
  const userId = session?.user?.id ?? mobile?.sub;
  const identity = userId ? await getActiveIdentity(userId) : null;
  const body = (await readJson(request).catch(() => null)) as {
    count?: unknown;
  } | null;
  const count =
    typeof body?.count === "number" && Number.isInteger(body.count)
      ? body.count
      : 0;
  if (count < 1 || count > 12)
    return NextResponse.json(
      { error: "Choose between 1 and 12 bot characters." },
      { status: 400 },
    );
  const tokens = Array.from({ length: count }, () => {
    const payload = Buffer.from(
      JSON.stringify({
        ...(identity
          ? {
              userId: identity.id,
              handle: identity.handle ?? identity.name ?? undefined,
            }
          : { guest: true }),
        botSeat: true,
        exp: Date.now() + 60_000,
      }),
    ).toString("base64url");
    const signature = createHmac("sha256", env.BACKEND_SECRET)
      .update(payload)
      .digest("base64url");
    return `${payload}.${signature}`;
  });
  return NextResponse.json(
    { tokens },
    { headers: { "Cache-Control": "no-store" } },
  );
}
