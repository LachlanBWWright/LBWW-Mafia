import { roleSandboxInputSchema } from "@mernmafia/shared/game/roleSandbox";
import { runRoleSandbox } from "../../model/roles/composition/roleSandbox.js";

const MAX_SCENARIO_BYTES = 16_384;

/** Guest-accessible, bounded simulations never create rooms or call external APIs. */
export async function roleSandboxRequest(
  request: Request,
  webOrigin: string,
): Promise<Response> {
  const origin = request.headers.get("origin");
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  if (origin && origin !== webOrigin)
    return new Response(null, { status: 403 });
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers });
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST")
    return reply({ error: "Use POST for a sandbox trial." }, 405);
  if (!request.headers.get("content-type")?.includes("application/json"))
    return reply({ error: "Use a JSON scenario." }, 415);
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "A scenario is required." }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_SCENARIO_BYTES) {
        await reader.cancel();
        return reply({ error: "Scenario exceeds 16 KB." }, 413);
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const input = roleSandboxInputSchema.safeParse(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
    if (!input.success)
      return reply({ error: "Invalid sandbox scenario." }, 400);
    return reply(runRoleSandbox(input.data));
  } catch {
    return reply({ error: "Invalid sandbox scenario." }, 400);
  } finally {
    reader.releaseLock();
  }
}
