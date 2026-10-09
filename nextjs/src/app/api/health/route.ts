import { sql } from "drizzle-orm";
import { db } from "~/server/db";
import { env } from "~/env";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${env.BACKEND_SECRET}`)
    return new Response(null, { status: 401 });
  const started = Date.now();
  try {
    await db.execute(sql`select 1`);
    return Response.json(
      { status: "ready", databaseLatencyMs: Date.now() - started },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error(
      JSON.stringify({
        event: "database.unavailable",
        at: new Date().toISOString(),
      }),
    );
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
