import { expect, it } from "vitest";
import { mergeDirectMessages } from "./directMessages";
import type { DirectMessage } from "../trpc/appRouter";
it("retains older pages and deduplicates refreshes for both clients", () => {
  const message = (id: number): DirectMessage => ({
    id,
    body: String(id),
    conversationId: 1,
    senderId: "a",
    senderName: "A",
    createdAt: new Date(id),
  });
  expect(
    mergeDirectMessages([message(1), message(2)], [message(2), message(3)]).map(
      (entry) => entry.id,
    ),
  ).toEqual([1, 2, 3]);
});
