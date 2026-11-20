import { z } from "zod";
import { lobbyConfigSchema, type LobbyConfig } from "./lobbyConfig";

export {
  gameRulesSchema,
  defaultGameRules,
  resolveGameRules,
} from "./gameRules";
export type { GameRules, ResolvedGameRules } from "./gameRules";
import { resolveGameRules } from "./gameRules";

export function summarizeGameSetup(config: LobbyConfig): string[] {
  const rules = resolveGameRules(config);
  return [
    `${config.size} players · ${config.roleSelection.algorithm.replaceAll("-", " ")}`,
    `Day ${rules.timing.daySeconds}s · night ${rules.timing.nightSeconds}s · opening ${rules.timing.firstDaySeconds}s · early finish ${rules.timing.earlyEnd ? "on" : "off"}`,
    `${rules.voting.method === "majority" ? "Majority" : "Plurality"} vote · ${config.voteVisibility === "hidden" ? "anonymous" : "public"} ballots · ${rules.voting.tie === "random" ? "random tie-break" : "ties spare everyone"} · vote changes ${rules.voting.allowRevote ? "allowed" : "locked"}`,
    `Death reveals: ${rules.reveal.onDeath} · role pool ${rules.reveal.rolePool ? "visible" : "hidden"}`,
    `Whispers ${rules.communication.whispers ? "on" : "off"} · ${rules.communication.messageLimit || "unlimited"} messages per phase · last words ${rules.communication.lastWords ? "on" : "off"}`,
    `Spectator chat ${rules.communication.observerChat ? "on" : "off"} · ${rules.presentation.theme} theme`,
    `${config.customRoles?.length ?? 0} custom roles`,
    `Bot filling ${rules.bots.fillEmptySeats ? "on" : "off"} · ${rules.bots.difficulty} · ${rules.bots.personality}`,
  ];
}

export function getSetupWarnings(config: LobbyConfig): string[] {
  const warnings: string[] = [];
  const ids =
    config.roleSelection.algorithm === "explicit-slots"
      ? config.roleSelection.explicitSlots
      : config.roleSelection.roles.map((rule) => rule.role);
  if (
    config.roleSelection.algorithm !== "normal" &&
    !ids.some(
      (id) =>
        id.startsWith("mafia") ||
        config.customRoles?.some(
          (role) => `custom:${role.id}` === id && role.alignment === "mafia",
        ),
    )
  )
    warnings.push(
      "No Mafia role is selected; check that the setup has opposing win conditions.",
    );
  if (config.size < 5)
    warnings.push("Small games can end after very few eliminations.");
  if (config.rules?.reveal?.onDeath === "none")
    warnings.push("Hidden death information makes deductions harder.");
  if (config.rules?.voting?.tie === "random")
    warnings.push("Tied votes can eliminate a randomly selected player.");
  return warnings;
}

export const GAME_PACK_VERSION = 1;
export const gamePackSchema = z
  .object({
    format: z.literal("lbww-mafia"),
    version: z.literal(GAME_PACK_VERSION),
    name: z.string().trim().min(1).max(80),
    description: z.string().max(1000).optional(),
    config: lobbyConfigSchema,
  })
  .strict();
export type GamePack = z.infer<typeof gamePackSchema>;
export function createGamePack(
  name: string,
  config: LobbyConfig,
  description?: string,
): GamePack {
  return gamePackSchema.parse({
    format: "lbww-mafia",
    version: GAME_PACK_VERSION,
    name,
    description,
    config,
  });
}
export function exportGamePack(pack: GamePack): string {
  return JSON.stringify(gamePackSchema.parse(pack), null, 2);
}
export function importGamePack(text: string): GamePack {
  if (new TextEncoder().encode(text).byteLength > 100_000)
    throw new Error("Game packs must be smaller than 100 KB.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Game pack is not valid JSON.");
  }
  return gamePackSchema.parse(value);
}
export function encodeGamePack(pack: GamePack): string {
  return encodeURIComponent(exportGamePack(pack));
}
export function decodeGamePack(value: string): GamePack {
  if (value.length > 300_000) throw new Error("Game pack link is too large.");
  return importGamePack(decodeURIComponent(value));
}
export function cloneGameSetup(config: LobbyConfig): LobbyConfig {
  return lobbyConfigSchema.parse(JSON.parse(JSON.stringify(config)));
}
function freezeRecursively(value: unknown): void {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeRecursively(child);
    Object.freeze(value);
  }
}
/** Validates and snapshots setup so later preset edits cannot mutate a running match. */
export function freezeGameSetup(config: LobbyConfig): LobbyConfig {
  const copy = cloneGameSetup(config);
  freezeRecursively(copy);
  return copy;
}
