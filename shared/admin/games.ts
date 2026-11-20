import { z } from "zod";
import { MAX_PLAYERS } from "../game/gameNames";

// Whitelist the operational snapshot. Never pass a room's raw state to clients.
export const adminRoomStateSchema = z.object({
  connections: z.number().int().nonnegative(),
  players: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  started: z.boolean(),
  ended: z.boolean(),
  closed: z.boolean(),
  reservedSeats: z.number().int().nonnegative(),
  phase: z.enum(["idle", "day", "night", "processing"]).optional(),
  day: z.number().int().nonnegative().optional(),
  roster: z
    .array(
      z.object({
        name: z.string().max(100),
        connected: z.boolean(),
        isBot: z.boolean(),
        alive: z.boolean().nullable(),
      }),
    )
    .max(MAX_PLAYERS)
    .optional(),
  historyPending: z.boolean(),
  historyAttempts: z.number().int().nonnegative(),
});
export type AdminRoomState = z.infer<typeof adminRoomStateSchema>;
export type AdminGame = {
  roomId: string;
  name: string;
  visibility: "public" | "link-only";
  state: AdminRoomState | null;
};
export type AdminGamePage = {
  games: AdminGame[];
  nextOffset: number | null;
  checkedAt: string;
};
export type AdminGameQuery = { offset: number; roomId?: string };
export function gameStatus(state: AdminRoomState | null) {
  return !state
    ? "Unavailable"
    : state.closed
      ? "Closed"
      : state.ended
        ? "Finished"
        : state.started
          ? "In progress"
          : "Waiting";
}

export function gamePhase(state: AdminRoomState) {
  if (!state.phase || state.phase === "idle") return "—";
  if (state.phase === "processing") return "Resolving night";
  return `${state.phase === "day" ? "Day" : "Night"} ${state.day ?? ""}`.trim();
}
