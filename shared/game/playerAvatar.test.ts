import { expect, it } from "vitest";
import { avatarInitials, gameAvatarIndex, gamePortraits } from "./playerAvatar";
import { MAX_PLAYERS } from "./gameNames";
import { iconExampleNames } from "../testing/iconFixtures";

it("uses the first visible character with a safe empty fallback", () => {
  expect(avatarInitials(" Mira ")).toBe("M");
  expect(avatarInitials("🦊 Fox")).toBe("🦊");
  expect(avatarInitials("  ")).toBe("?");
});
it("derives a repeatable portrait from the displayed game name", () => {
  expect(gameAvatarIndex("Mira")).toBe(gameAvatarIndex("Mira"));
  expect(gameAvatarIndex("Mira")).toBeLessThan(MAX_PLAYERS);
});
it("shows each placeholder once in the example catalog", () => {
  expect(iconExampleNames.map(gameAvatarIndex)).toEqual(Array.from({ length: MAX_PLAYERS }, (_, i) => i));
  expect(gamePortraits).toHaveLength(MAX_PLAYERS);
  expect(new Set(gamePortraits.map((portrait) => JSON.stringify(portrait))).size).toBe(MAX_PLAYERS);
});
