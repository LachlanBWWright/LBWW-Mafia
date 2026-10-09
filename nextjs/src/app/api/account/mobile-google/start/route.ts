import { z } from "zod";
import { guardRequest, readJson } from "~/server/reliability/requests";
import { startMobileGoogle } from "~/server/auth/mobileGoogle";
export async function POST(request: Request) {
  const limited = await guardRequest(request, "mobile-google-start", 20);
  if (limited) return limited;
  const parsed = z
    .object({ challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/) })
    .safeParse(await readJson(request).catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Invalid sign-in request." },
      { status: 400 },
    );
  const state = await startMobileGoogle(parsed.data.challenge);
  return Response.json({ state }, { headers: { "Cache-Control": "no-store" } });
}
