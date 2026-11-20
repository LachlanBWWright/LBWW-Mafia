import { z } from "zod";

export const customRoleEffects = ["protect", "investigate", "block", "attack", "redirect"] as const;
/** A deliberately data-only role format. Redirect sends a target's action to the redirector. */
export const customRoleSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(500).default(""),
  alignment: z.enum(["town", "mafia"]),
  trigger: z.literal("night").default("night"),
  effect: z.enum(customRoleEffects),
  target: z.enum(["other", "any"]).default("other"),
  charges: z.number().int().min(1).max(64).optional(),
  cooldownNights: z.number().int().min(0).max(10).default(0),
  noRepeatTarget: z.boolean().default(false),
  investigationAccuracy: z.number().int().min(0).max(100).default(100),
  winCondition: z.literal("faction").default("faction"),
}).strict().superRefine((role, ctx) => {
  if (role.effect !== "investigate" && role.investigationAccuracy !== 100)
    ctx.addIssue({ code: "custom", path: ["investigationAccuracy"], message: "Accuracy applies only to investigation." });
  if (role.effect === "redirect" && role.target !== "other")
    ctx.addIssue({ code: "custom", path: ["target"], message: "Redirect must target another player." });
});
export type CustomRole = z.infer<typeof customRoleSchema>;
export function customRoleSelectionId(role: Pick<CustomRole, "id">): string { return `custom:${role.id}`; }
export function createCustomRoleDraft(): CustomRole {
  return customRoleSchema.parse({ id: "field-medic", name: "Field Medic", alignment: "town", effect: "protect", charges: 2, noRepeatTarget: true });
}
export function describeCustomRole(role: CustomRole): string {
  return `${role.name}: ${role.alignment}, ${role.effect} at night${role.effect === "redirect" ? " (redirect target to yourself)" : ""}. ${role.charges ?? "Unlimited"} uses; ${role.cooldownNights} cooldown nights${role.noRepeatTarget ? "; cannot target the same player on consecutive nights" : ""}.`;
}
