import { z } from "zod";

export const lobbyRoles = [
  ["bodyguard", "Bodyguard"],
  ["doctor", "Doctor"],
  ["fortifier", "Fortifier"],
  ["investigator", "Investigator"],
  ["jailor", "Jailor"],
  ["judge", "Judge"],
  ["lawman", "Lawman"],
  ["nimby", "Nimby"],
  ["roleblocker", "Roleblocker"],
  ["sacrificer", "Sacrificer"],
  ["tapper", "Tapper"],
  ["tracker", "Tracker"],
  ["vetter", "Vetter"],
  ["watchman", "Watchman"],
  ["mafia", "Mafia"],
  ["mafia-investigator", "Mafia Investigator"],
  ["mafia-roleblocker", "Mafia Roleblocker"],
  ["confesser", "Confesser"],
  ["framer", "Framer"],
  ["maniac", "Maniac"],
  ["peacemaker", "Peacemaker"],
  ["sniper", "Sniper"],
] as const;
export const uniqueLobbyRoles = new Set([
  "jailor",
  "lawman",
  "confesser",
  "framer",
  "maniac",
  "peacemaker",
  "sniper",
]);
const roleId = z.enum(lobbyRoles.map(([id]) => id));
export const selectionAlgorithms = [
  ["weighted-random", "Weighted random"],
  ["tier-balanced", "Tier balanced"],
  ["explicit-slots", "Explicit slots"],
] as const;
export const lobbyConfigSchema = z
  .object({
    size: z.number().int().min(2).max(64),
    voteVisibility: z.enum(["public", "hidden"]).optional(),
    roleSelection: z
      .object({
        algorithm: z.enum([
          "weighted-random",
          "tier-balanced",
          "explicit-slots",
        ]),
        roles: z
          .array(
            z
              .object({
                role: roleId,
                weight: z.number().finite().min(0).max(1000).default(1),
                minimum: z.number().int().min(0).max(64).default(0),
                maximum: z.number().int().min(0).max(64).optional(),
                tier: z.number().int().min(0).max(100).optional(),
              })
              .strict(),
          )
          .max(lobbyRoles.length)
          .default([]),
        explicitSlots: z.array(roleId).max(64).default([]),
      })
      .strict(),
  })
  .strict()
  .superRefine((config, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const { algorithm, roles, explicitSlots } = config.roleSelection;
    if (new Set(roles.map((rule) => rule.role)).size !== roles.length)
      fail("Each role may appear only once in the role pool.");
    for (const rule of roles) {
      const cap = Math.min(
        rule.maximum ?? config.size,
        uniqueLobbyRoles.has(rule.role) ? 1 : config.size,
      );
      if (rule.minimum > cap)
        fail(`${rule.role}: minimum exceeds its maximum or uniqueness limit.`);
      if (uniqueLobbyRoles.has(rule.role) && (rule.maximum ?? 1) > 1)
        fail(`${rule.role} is unique; maximum must be at most one.`);
    }
    if (algorithm === "explicit-slots") {
      if (explicitSlots.length !== config.size)
        fail("Role slot count must equal player count.");
      for (const role of uniqueLobbyRoles)
        if (explicitSlots.filter((id) => id === role).length > 1)
          fail(`${role} is unique.`);
    } else {
      if (!roles.length) fail("Enable at least one role.");
      if (explicitSlots.length)
        fail("Role slots are only supported by the explicit slots algorithm.");
      const minimum = roles.reduce((sum, rule) => sum + rule.minimum, 0);
      const capacity = roles.reduce(
        (sum, rule) =>
          sum +
          (rule.weight > 0
            ? Math.min(
                rule.maximum ?? config.size,
                uniqueLobbyRoles.has(rule.role) ? 1 : config.size,
              )
            : rule.minimum),
        0,
      );
      if (minimum > config.size) fail("Role minimums exceed player count.");
      if (capacity < config.size)
        fail("The enabled role pool cannot fill all player slots.");
    }
  });
export type LobbyConfig = z.infer<typeof lobbyConfigSchema>;
export type RoleForm = {
  enabled: boolean;
  weight: string;
  minimum: string;
  maximum: string;
  tier: string;
};
export function initialRoleForms(): Record<string, RoleForm> {
  return Object.fromEntries(
    lobbyRoles.map(([id]) => [
      id,
      { enabled: false, weight: "1", minimum: "0", maximum: "", tier: "" },
    ]),
  );
}
export function parseLobbyForm(
  size: string,
  algorithm: string,
  roleForms: Record<string, RoleForm>,
  slots: string,
) {
  return lobbyConfigSchema.safeParse({
    size: Number(size),
    roleSelection: {
      algorithm,
      roles:
        algorithm === "explicit-slots"
          ? []
          : lobbyRoles
              .filter(([id]) => roleForms[id]?.enabled)
              .map(([role]) => {
                const form = roleForms[role]!;
                return {
                  role,
                  weight: Number(form.weight),
                  minimum: Number(form.minimum),
                  maximum: form.maximum ? Number(form.maximum) : undefined,
                  tier: form.tier ? Number(form.tier) : undefined,
                };
              }),
      explicitSlots:
        algorithm === "explicit-slots"
          ? slots
              .split(",")
              .map((id) => id.trim())
              .filter(Boolean)
          : [],
    },
  });
}

/** Selects a full constrained roster. Tier balancing fills the least-used available tier first. */
export function selectLobbyRoles(
  config: LobbyConfig,
  random: () => number = Math.random,
): string[] {
  const { algorithm, roles, explicitSlots } = config.roleSelection;
  if (algorithm === "explicit-slots") return [...explicitSlots];
  const roster = roles.flatMap((rule) =>
    Array<string>(rule.minimum).fill(rule.role),
  );
  while (roster.length < config.size) {
    let available = roles.filter(
      (rule) =>
        rule.weight > 0 &&
        roster.filter((id) => id === rule.role).length <
          Math.min(
            rule.maximum ?? config.size,
            uniqueLobbyRoles.has(rule.role) ? 1 : config.size,
          ),
    );
    if (algorithm === "tier-balanced") {
      const countTier = (tier: number) =>
        roster.filter(
          (id) => (roles.find((rule) => rule.role === id)?.tier ?? 0) === tier,
        ).length;
      const lowest = Math.min(
        ...available.map((rule) => countTier(rule.tier ?? 0)),
      );
      available = available.filter(
        (rule) => countTier(rule.tier ?? 0) === lowest,
      );
    }
    let ticket =
      random() * available.reduce((sum, rule) => sum + rule.weight, 0);
    const chosen =
      available.find((rule) => (ticket -= rule.weight) < 0) ??
      available[available.length - 1];
    if (!chosen) throw new Error("Role pool exhausted");
    roster.push(chosen.role);
  }
  return roster;
}
