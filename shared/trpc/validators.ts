import { z } from "zod";

/**
 * Validator for match history events.
 * Ensures type safety when deserializing stored JSON.
 */
export const MatchHistoryEventSchema = z.discriminatedUnion("type", [
  z.object({
    time: z.number(),
    type: z.literal("system"),
    actor: z.string().optional(),
    target: z.string().optional(),
    content: z.string(),
  }),
  z.object({
    time: z.number(),
    type: z.literal("chat"),
    actor: z.string(),
    target: z.string().optional(),
    content: z.string(),
  }),
  z.object({
    time: z.number(),
    type: z.literal("whisper"),
    actor: z.string(),
    target: z.string(),
    content: z.string(),
  }),
  z.object({
    time: z.number(),
    type: z.literal("action"),
    actor: z.string(),
    target: z.string().optional(),
    content: z.string(),
  }),
]);

export type MatchHistoryEvent = z.infer<typeof MatchHistoryEventSchema>;

/**
 * Safely deserializes a JSON string into validated MatchHistoryEvent array.
 * Returns empty array if deserialization or validation fails.
 *
 * @param value - JSON string to deserialize
 * @returns Validated array of events, or empty array on error
 */
export const deserializeEventHistory = (value: string): MatchHistoryEvent[] => {
  try {
    const parsed = JSON.parse(value) as unknown;
    const events = z.array(MatchHistoryEventSchema).safeParse(parsed);
    if (events.success) {
      return events.data;
    }
    console.error("Failed to validate event history:", events.error);
  } catch (error) {
    console.error("Failed to deserialize event history JSON", error);
  }
  return [];
};

/**
 * Safely deserializes a JSON string into validated string array.
 * Returns empty array if deserialization fails.
 *
 * @param value - JSON string to deserialize
 * @returns Validated array of strings, or empty array on error
 */
export const deserializeStringArray = (value: string): string[] => {
  try {
    const parsed = JSON.parse(value) as unknown;
    const result = z.array(z.string()).safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.error("Failed to validate string array:", result.error);
  } catch (error) {
    console.error("Failed to deserialize string array JSON", error);
  }
  return [];
};
