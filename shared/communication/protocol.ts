import { z } from "zod";
import {
  ClientEvent,
  DayTime,
  JoinRoomResultCode,
  PartyKitMessageType,
  ServerEvent,
} from "./events";
import { MessageKey } from "./messages";

export const CHAT_MESSAGE_MIN_LENGTH = 1;
export const CHAT_MESSAGE_MAX_LENGTH = 150;

export const clientPhaseSchema = z.nativeEnum(DayTime);
export const recipientIndexSchema = z.number().int().nonnegative();
export const chatMessageSchema = z
  .string()
  .min(CHAT_MESSAGE_MIN_LENGTH)
  .max(CHAT_MESSAGE_MAX_LENGTH);

export const joinRoomResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("joined"),
    username: z.string(),
  }),
  z.object({
    status: z.literal("rejected"),
    code: z.nativeEnum(JoinRoomResultCode),
  }),
]);

export const joinRoomCallbackArgsSchema = z.tuple([joinRoomResultSchema]);
export const joinRoomArgsSchema = z.tuple([z.string(), z.string().optional()]);
export const messageSentArgsSchema = z.tuple([chatMessageSchema, clientPhaseSchema]);
export const voteArgsSchema = z.tuple([recipientIndexSchema, clientPhaseSchema]);
export const visitArgsSchema = z.tuple([
  recipientIndexSchema.nullable(),
  clientPhaseSchema,
]);
export const whisperArgsSchema = z.tuple([
  recipientIndexSchema,
  chatMessageSchema,
  clientPhaseSchema,
]);

export const playerNamePayloadSchema = z.object({
  name: z.string(),
});

export const playerListPayloadSchema = z.array(
  z.object({
    name: z.string(),
    isAlive: z.boolean().optional(),
    role: z.string().optional(),
  }),
);

export const playerReturnedPayloadSchema = z.object({
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

export const updateDayTimePayloadSchema = z.object({
  time: clientPhaseSchema,
  dayNumber: z.number(),
  timeLeft: z.number(),
});

export const updatePlayerRolePayloadSchema = z.object({
  name: z.string(),
  role: z.string().optional(),
});

export const updateFactionRolePayloadSchema = z.object({
  name: z.string(),
  role: z.string(),
});

export const gameMessagePayloadSchema = z.object({
  key: z.nativeEnum(MessageKey),
  params: z
    .object({
      playerName: z.string().optional(),
      targetName: z.string().optional(),
      roleName: z.string().optional(),
      voterName: z.string().optional(),
      count: z.number().optional(),
      dayNumber: z.number().optional(),
      list: z.string().optional(),
      role1: z.string().optional(),
      role2: z.string().optional(),
      role3: z.string().optional(),
      factionName: z.string().optional(),
      senderName: z.string().optional(),
      recipientName: z.string().optional(),
      message: z.string().optional(),
      name1: z.string().optional(),
      name2: z.string().optional(),
    })
    .optional(),
});

export const partykitClientEventEnvelopeSchema = z.object({
  type: z.literal(PartyKitMessageType.Event),
  event: z.nativeEnum(ClientEvent),
  args: z.array(z.unknown()),
  callbackId: z.string().optional(),
});

export const partykitServerEventEnvelopeSchema = z.object({
  type: z.literal(PartyKitMessageType.Event),
  event: z.nativeEnum(ServerEvent),
  args: z.array(z.unknown()),
});

export const partykitCallbackEnvelopeSchema = z.object({
  type: z.literal(PartyKitMessageType.Callback),
  callbackId: z.string(),
  args: z.array(z.unknown()),
});

export const partykitServerEnvelopeSchema = z.discriminatedUnion("type", [
  partykitServerEventEnvelopeSchema,
  partykitCallbackEnvelopeSchema,
]);

export const supabaseClientEnvelopeSchema = z.object({
  roomId: z.string().min(1),
  socketId: z.string().min(1),
  message: partykitClientEventEnvelopeSchema,
});
