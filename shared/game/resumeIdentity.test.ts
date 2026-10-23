import { expect, it } from "vitest";
import { roomResumeStorageKey } from "./resumeIdentity";
it("isolates room secrets by account and participation with a platform-safe storage key", () => {
  const keys = [
    roomResumeStorageKey("room", "player", "a"),
    roomResumeStorageKey("room", "spectator", "a"),
    roomResumeStorageKey("room", "player", "b"),
    roomResumeStorageKey("other", "player", "a"),
  ];
  expect(new Set(keys).size).toBe(4);
  expect(keys.every((key) => /^[a-zA-Z0-9_.-]+$/.test(key))).toBe(true);
  expect(roomResumeStorageKey("room", "player", "a")).toBe(keys[0]);
});
