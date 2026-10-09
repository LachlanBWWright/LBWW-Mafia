import { z } from "zod";
import { guardRequest, readJson } from "~/server/reliability/requests";
import { consumeMobileGoogle } from "~/server/auth/mobileGoogle";
import { createMobileSession } from "~/server/auth/mobileToken";
import { getActiveIdentity } from "~/server/auth/identity";
export async function POST(request: Request) {
  const limited = await guardRequest(request, "mobile-google-exchange", 30);
  if (limited) return limited;
  const parsed = z
    .object({
      state: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      code: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
      verifier: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
      deviceName: z.string().min(1).max(80).optional(),
    })
    .safeParse(await readJson(request).catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Invalid sign-in request." },
      { status: 400 },
    );
  const userId = await consumeMobileGoogle(
    parsed.data.state,
    parsed.data.code,
    parsed.data.verifier,
  );
  if (!userId)
    return Response.json(
      { error: "Sign-in expired. Try again." },
      { status: 401 },
    );
  const user = await getActiveIdentity(userId);
  if (!user)
    return Response.json({ error: "Account unavailable." }, { status: 401 });
  return Response.json(
    {
      ...(await createMobileSession(user, parsed.data.deviceName)),
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        isAdmin: user.isAdmin,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
