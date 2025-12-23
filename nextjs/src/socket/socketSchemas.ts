import { z } from "zod";
import { Time } from "~/types/shared";

export const PlayerItemSchema = z.object({
  name: z.string(),
  isAlive: z.boolean().optional(),
  role: z.string().optional(),
});

export const ReceiveMessageDataSchema = z.object({ message: z.string() });
export const ReceiveChatMessageDataSchema = z.object({ message: z.string() });
export const ReceiveWhisperMessageDataSchema = z.object({
  message: z.string(),
});
export const ReceivePlayerListDataSchema = z.object({
  playerList: z.array(PlayerItemSchema),
});
export const ReceiveNewPlayerDataSchema = z.object({
  player: z.object({ name: z.string() }),
});
export const RemovePlayerDataSchema = z.object({
  player: z.object({ name: z.string() }),
});
export const AssignPlayerRoleDataSchema = z.object({
  name: z.string(),
  role: z.string(),
  dayVisitSelf: z.boolean(),
  dayVisitOthers: z.boolean(),
  dayVisitFaction: z.boolean(),
  nightVisitSelf: z.boolean(),
  nightVisitOthers: z.boolean(),
  nightVisitFaction: z.boolean(),
  nightVote: z.boolean(),
});
export const UpdateFactionRoleDataSchema = z.object({
  name: z.string(),
  role: z.string(),
});
export const UpdatePlayerRoleDataSchema = z.object({
  name: z.string(),
  role: z.string().optional(),
});
export const UpdateDayTimeDataSchema = z.object({
  time: z.nativeEnum(Time),
  dayNumber: z.number(),
  timeLeft: z.number(),
});
export const JoinRoomCallbackSchema = z.object({
  result: z.union([z.string(), z.number()]),
});

// Generic helpers
export const MessageToClientSchema = z.object({
  name: z.string(),
  data: z.any().optional(),
});
