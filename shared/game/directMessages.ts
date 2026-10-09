import type { DirectMessage } from "../trpc/appRouter";
export const MESSAGE_PAGE_SIZE = 50;
export const MESSAGE_REFRESH_MS = 10_000;
/** Keep loaded history when new messages arrive and deduplicate overlapping pages. */
export function mergeDirectMessages(
  current: DirectMessage[],
  incoming: DirectMessage[],
) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((first, second) => first.id - second.id);
}
