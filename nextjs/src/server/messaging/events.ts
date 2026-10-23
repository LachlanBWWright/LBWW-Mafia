import postgres from "postgres";
import { z } from "zod";
import { env } from "~/env";
import {
  messageDatabaseUrl,
  postgresConnectionUrl,
} from "../db/connectionConfig";

const notificationSchema = z.object({
  userId: z.string(),
  messageId: z.number().int(),
  conversationId: z.number().int(),
});
export type MessageNotification = z.infer<typeof notificationSchema>;

/** PostgreSQL LISTEN/NOTIFY connects SSE subscriptions across web instances.
 * The URL must support session connections, rather than transaction pooling.
 * Only IDs are sent, keeping payloads below PostgreSQL's NOTIFY size limit.
 */
export function createMessageBus(url: string) {
  const client = postgres(
    postgresConnectionUrl(messageDatabaseUrl({ DATABASE_URL: url })),
    { max: 1, idle_timeout: 5, connect_timeout: 10, prepare: false },
  );
  return {
    async subscribe(
      userId: string,
      listener: (event: MessageNotification) => void,
    ) {
      const subscription = await client.listen(
        "mafia_direct_messages",
        (payload) => {
          try {
            const parsed = notificationSchema.safeParse(JSON.parse(payload));
            if (parsed.success && parsed.data.userId === userId)
              listener(parsed.data);
          } catch {
            /* Ignore unrelated or malformed notifications. */
          }
        },
      );
      return () => subscription.unlisten();
    },
    close: () => client.end({ timeout: 1 }),
  };
}
let bus: ReturnType<typeof createMessageBus> | undefined;
export async function subscribeToDirectMessages(
  userId: string,
  listener: (event: MessageNotification) => void,
) {
  bus ??= createMessageBus(messageDatabaseUrl(env));
  return bus.subscribe(userId, listener);
}
