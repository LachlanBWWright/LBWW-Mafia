import { z } from "zod";

/** Common claims carried by non-cookie credentials across web and mobile. */
export const AuthClaimsSchema = z.object({
  sub: z.string().min(1),
  kind: z.enum(["mobile", "web"]),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});

export type AuthClaims = z.infer<typeof AuthClaimsSchema>;

export function isAuthClaimsActive(claims: AuthClaims, now = Date.now()) {
  return claims.exp > now;
}
