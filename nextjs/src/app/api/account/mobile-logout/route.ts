import { revokeMobileSession } from "~/server/auth/mobileToken";
import { guardRequest, readJson } from "~/server/reliability/requests";
import { z } from "zod";
export async function POST(request: Request) {
  const limited = await guardRequest(request, "mobile-logout", 60);
  if (limited) return limited;
  const parsed = z
    .object({ refreshToken: z.string().min(32).max(128) })
    .safeParse(await readJson(request).catch(() => null));
  if (parsed.success) await revokeMobileSession(parsed.data.refreshToken);
  return new Response(null, { status: 204 });
}
