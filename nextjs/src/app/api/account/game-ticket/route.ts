import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { env } from "~/env";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ token: null });
  const payload = Buffer.from(JSON.stringify({ userId: session.user.id, handle: session.user.handle ?? session.user.name ?? undefined, exp: Date.now() + 60_000 })).toString("base64url");
  const signature = createHmac("sha256", env.BACKEND_SECRET).update(payload).digest("base64url");
  return NextResponse.json({ token: `${payload}.${signature}` });
}
