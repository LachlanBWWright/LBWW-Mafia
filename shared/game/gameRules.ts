import { z } from "zod";
export const gameRulesSchema = z
  .object({
    timing: z
      .object({
        daySeconds: z.number().int().min(10).max(900).optional(),
        nightSeconds: z.number().int().min(5).max(300).optional(),
        firstDaySeconds: z.number().int().min(5).max(900).optional(),
        earlyEnd: z.boolean().optional(),
      })
      .strict()
      .optional(),
    voting: z
      .object({
        method: z.enum(["majority", "plurality"]).optional(),
        tie: z.enum(["none", "random"]).optional(),
        allowRevote: z.boolean().optional(),
      })
      .strict()
      .optional(),
    reveal: z
      .object({
        onDeath: z.enum(["role", "faction", "none"]).optional(),
        rolePool: z.boolean().optional(),
      })
      .strict()
      .optional(),
    communication: z
      .object({
        whispers: z.boolean().optional(),
        messageLimit: z.number().int().min(0).max(100).optional(),
        lastWords: z.boolean().optional(),
        observerChat: z.boolean().optional(),
      })
      .strict()
      .optional(),
    presentation: z
      .object({
        theme: z.enum(["classic", "noir", "midnight"]).optional(),
        announcementStyle: z.enum(["classic", "concise"]).optional(),
      })
      .strict()
      .optional(),
    bots: z
      .object({
        fillEmptySeats: z.boolean().optional(),
        difficulty: z.enum(["casual", "standard", "challenging"]).optional(),
        personality: z
          .enum(["cautious", "argumentative", "deceptive"])
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type GameRules = z.infer<typeof gameRulesSchema>;
export const defaultGameRules = {
  timing: {
    daySeconds: 60,
    nightSeconds: 15,
    firstDaySeconds: 5,
    earlyEnd: false,
  },
  voting: { method: "majority", tie: "none", allowRevote: false },
  reveal: { onDeath: "role", rolePool: false },
  communication: {
    whispers: true,
    messageLimit: 0,
    lastWords: false,
    observerChat: true,
  },
  presentation: { theme: "classic", announcementStyle: "classic" },
  bots: {
    fillEmptySeats: false,
    difficulty: "standard",
    personality: "cautious",
  },
} as const;
export type ResolvedGameRules = {
  [K in keyof typeof defaultGameRules]: Required<NonNullable<GameRules[K]>>;
};
export function resolveGameRules(config: {
  rules?: GameRules;
  size?: number;
}): ResolvedGameRules {
  const rules = config.rules;
  return {
    timing: {
      ...defaultGameRules.timing,
      // Older saved setups predate explicit timing rules; preserve their runtime pace.
      ...(!rules && config.size !== undefined ? { daySeconds: config.size * 4 + 10 } : {}),
      ...rules?.timing,
    },
    voting: { ...defaultGameRules.voting, ...rules?.voting },
    reveal: { ...defaultGameRules.reveal, ...rules?.reveal },
    communication: {
      ...defaultGameRules.communication,
      ...rules?.communication,
    },
    presentation: { ...defaultGameRules.presentation, ...rules?.presentation },
    bots: { ...defaultGameRules.bots, ...rules?.bots },
  };
}
