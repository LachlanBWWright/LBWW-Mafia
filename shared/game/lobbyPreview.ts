import { z } from "zod";
import { customRoleSchema } from "./customRoles";
import { type LobbyConfig } from "./lobbyConfig";
import { gameRulesSchema, resolveGameRules } from "./gameRules";
import { MAX_PLAYERS } from "./gameNames";

export const lobbyRoomIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const lobbyPreviewSchema = z
  .object({
    roomId: lobbyRoomIdSchema,
    size: z.number().int().min(2).max(MAX_PLAYERS),
    setup: z
      .object({
        rules: gameRulesSchema.transform((rules) =>
          resolveGameRules({ rules }),
        ),
        voteVisibility: z.enum(["public", "hidden"]),
        rolePool: z.array(z.string().max(100)).max(128).optional(),
        customRoles: z.array(customRoleSchema).max(16).optional(),
      })
      .strict(),
  })
  .strict();
export type LobbyPreview = z.infer<typeof lobbyPreviewSchema>;
/** Deliberately excludes lobby owners, participants, assignments and selection weights. */
export function createLobbyPreview(
  roomId: string,
  config: LobbyConfig,
): LobbyPreview {
  const rules = resolveGameRules(config);
  const roles =
    config.roleSelection.algorithm === "explicit-slots"
      ? config.roleSelection.explicitSlots
      : config.roleSelection.roles.map((role) => role.role);
  return lobbyPreviewSchema.parse({
    roomId,
    size: config.size,
    setup: {
      rules,
      voteVisibility: config.voteVisibility ?? "public",
      customRoles: config.customRoles,
      ...(rules.reveal.rolePool && config.roleSelection.algorithm !== "normal"
        ? { rolePool: [...new Set(roles)] }
        : {}),
    },
  });
}
export async function requestLobbyPreview(
  roomId: string,
  baseUrl = "",
  signal?: AbortSignal,
): Promise<LobbyPreview | null> {
  lobbyRoomIdSchema.parse(roomId);
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 10000);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(
      `${baseUrl}/api/lobbies/${encodeURIComponent(roomId)}/preview`,
      { cache: "no-store", signal: controller.signal },
    );
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error("Unable to load this game’s setup. Please try again.");
    const body: unknown = await response.json();
    const preview = lobbyPreviewSchema.parse(body);
    if (preview.roomId !== roomId)
      throw new Error("The game setup did not match this room.");
    return preview;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
