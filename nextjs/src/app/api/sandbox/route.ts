import { roleSandboxInputSchema } from "@mernmafia/shared/game/roleSandbox";
import { roleSandboxResultSchema } from "@mernmafia/shared/game/roleSandboxClient";
import { env } from "~/env";
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const input = roleSandboxInputSchema.safeParse(body);
  if (!input.success)
    return Response.json(
      { error: "Invalid sandbox scenario." },
      { status: 400 },
    );
  try {
    const url = new URL("/sandbox", env.NEXT_PUBLIC_SOCKET_URL);
    if (url.protocol === "ws:") url.protocol = "http:";
    if (url.protocol === "wss:") url.protocol = "https:";
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.data),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!upstream.ok)
      return Response.json(
        { error: "Sandbox unavailable." },
        { status: upstream.status },
      );
    let resultBody: unknown;
    try {
      resultBody = await upstream.json();
    } catch {
      return Response.json(
        { error: "Invalid sandbox response." },
        { status: 502 },
      );
    }
    const result = roleSandboxResultSchema.safeParse(resultBody);
    if (
      !result.success ||
      result.data.nights.length !== input.data.nights ||
      result.data.nights.some((night, index) => night.night !== index + 1)
    )
      return Response.json(
        { error: "Invalid sandbox response." },
        { status: 502 },
      );
    return Response.json(result.data);
  } catch {
    return Response.json(
      { error: "Sandbox could not be reached." },
      { status: 503 },
    );
  }
}
