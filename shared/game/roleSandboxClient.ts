import { z } from "zod";
import { roleSandboxInputSchema, type RoleSandboxInput } from "./roleSandbox";
export const roleSandboxResultSchema = z.object({
  nights: z
    .array(
      z.object({
        night: z.number().int().positive(),
        accepted: z.boolean(),
        targetDamage: z.number().finite(),
        targetDefence: z.number().finite(),
        targetBlocked: z.boolean(),
        redirectedToActor: z.boolean(),
        notices: z.array(z.string()),
      }),
    )
    .min(1)
    .max(5),
});
export async function requestRoleSandbox(
  input: RoleSandboxInput,
  endpoint = "/api/sandbox",
) {
  const parsed = roleSandboxInputSchema.parse(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        `Sandbox unavailable (${response.status}). Please try again.`,
      );
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error(
        "The sandbox returned an invalid result. Please try again.",
      );
    }
    const result = roleSandboxResultSchema.safeParse(body);
    if (
      !result.success ||
      result.data.nights.length !== parsed.nights ||
      result.data.nights.some((night, index) => night.night !== index + 1)
    )
      throw new Error(
        "The sandbox returned an invalid result. Please try again.",
      );
    return result.data;
  } finally {
    clearTimeout(timeout);
  }
}
