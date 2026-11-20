import { z } from "zod";
import { customRoleSchema } from "./customRoles";
export const roleSandboxInputSchema = z.object({
  role: customRoleSchema,
  nights: z.number().int().min(1).max(5).default(3),
  targetAlignment: z.enum(["town", "mafia"]).default("mafia"),
  incomingAttack: z.boolean().default(false),
  randomSample: z.number().min(0).max(0.999999).default(0),
}).strict();
export type RoleSandboxInput = z.input<typeof roleSandboxInputSchema>;
export type RoleSandboxResult = { nights: { night: number; accepted: boolean; targetDamage: number; targetDefence: number; targetBlocked: boolean; redirectedToActor: boolean; notices: string[] }[] };
