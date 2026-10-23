import { expect, it } from "vitest";
import { anonymizeHistory } from "./accountAnonymization";
it("removes erased actors, targets and system mentions without changing unrelated events", () => {
  expect(
    anonymizeHistory(
      [
        { time: 1, type: "chat", actor: "Alice", content: "secret" },
        { time: 2, type: "system", content: "Alice has joined" },
        {
          time: 3,
          type: "action",
          actor: "Bob",
          target: "Alice",
          content: "visit",
        },
        { time: 4, type: "chat", actor: "Bob", content: "hello" },
      ],
      new Set(["Alice"]),
    ),
  ).toEqual([
    { time: 1, type: "chat", actor: "Deleted player", content: "[Removed]" },
    { time: 2, type: "system", content: "[Removed]" },
    {
      time: 3,
      type: "action",
      actor: "Bob",
      target: "Deleted player",
      content: "[Removed]",
    },
    { time: 4, type: "chat", actor: "Bob", content: "hello" },
  ]);
});
