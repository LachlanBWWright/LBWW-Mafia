import { refreshMobileSession } from "~/server/auth/mobileToken";
import { guardRequest, readJson } from "~/server/reliability/requests";
import { z } from "zod";
export async function POST(request: Request) {
  const limited = await guardRequest(request, "mobile-refresh", 60);
  if (limited) return limited;
  const parsed = z
    .object({ refreshToken: z.string().min(32).max(128) })
    .safeParse(await readJson(request).catch(() => null));
  const session = parsed.success
    ? await refreshMobileSession(parsed.data.refreshToken)
    : null;
  return session
    ? Response.json(session, { headers: { "Cache-Control": "no-store" } })
    : Response.json({ error: "Sign in required." }, { status: 401 });
}
