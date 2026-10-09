import type { NextRequest } from "next/server";
import { handlers } from "~/server/auth";
import { guardRequest } from "~/server/reliability/requests";
export const GET = handlers.GET;
export async function POST(request: NextRequest) {
  const limited = await guardRequest(request, "web-auth", 60);
  if (limited) return limited;
  if (Number(request.headers.get("content-length")) > 16_384)
    return new Response("Request too large", { status: 413 });
  return handlers.POST(request);
}
