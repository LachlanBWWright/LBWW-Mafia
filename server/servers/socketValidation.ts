import {
  DayTime,
  JoinRoomResultCode,
  type JoinRoomResult,
} from "../../shared/communication/events.js";
import {
  joinRoomArgsSchema,
  messageSentArgsSchema,
  visitArgsSchema,
  voteArgsSchema,
  whisperArgsSchema,
} from "../../shared/communication/protocol.js";

export function parseJoinRoomToken(captchaToken: unknown): string | null {
  const parsed = joinRoomArgsSchema.safeParse([captchaToken]);
  if (!parsed.success) {
    return null;
  }
  return parsed.data[0];
}

export function parseMessageSentPayload(
  message: unknown,
  phase: unknown,
): { message: string; phase: DayTime } | null {
  const parsed = messageSentArgsSchema.safeParse([message, phase]);
  if (!parsed.success) {
    return null;
  }
  const [parsedMessage, parsedPhase] = parsed.data;
  return { message: parsedMessage, phase: parsedPhase };
}

export function parseVotePayload(
  recipient: unknown,
  phase: unknown,
): { recipient: number; phase: DayTime } | null {
  const parsed = voteArgsSchema.safeParse([recipient, phase]);
  if (!parsed.success) {
    return null;
  }
  const [parsedRecipient, parsedPhase] = parsed.data;
  return { recipient: parsedRecipient, phase: parsedPhase };
}

export function parseVisitPayload(
  recipient: unknown,
  phase: unknown,
): { recipient: number | null; phase: DayTime } | null {
  const parsed = visitArgsSchema.safeParse([recipient, phase]);
  if (!parsed.success) {
    return null;
  }
  const [parsedRecipient, parsedPhase] = parsed.data;
  return { recipient: parsedRecipient, phase: parsedPhase };
}

export function parseWhisperPayload(
  recipient: unknown,
  message: unknown,
  phase: unknown,
): { recipient: number; message: string; phase: DayTime } | null {
  const parsed = whisperArgsSchema.safeParse([recipient, message, phase]);
  if (!parsed.success) {
    return null;
  }
  const [parsedRecipient, parsedMessage, parsedPhase] = parsed.data;
  return {
    recipient: parsedRecipient,
    message: parsedMessage,
    phase: parsedPhase,
  };
}

export function isJoinRoomCallback(
  value: unknown,
): value is (result: JoinRoomResult) => void {
  return typeof value === "function";
}

export function rejectJoin(code: JoinRoomResultCode): JoinRoomResult {
  return {
    status: "rejected",
    code,
  };
}
