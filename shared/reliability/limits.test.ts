import { expect, it } from "vitest";
import { CommandLimiter, retryDelay } from "./limits";
it("bounds bursts and refills independently", () => {
  const limit = new CommandLimiter(2, 1);
  expect([
    limit.allow("a", 1000),
    limit.allow("a", 1000),
    limit.allow("a", 1000),
  ]).toEqual([true, true, false]);
  expect(limit.allow("b", 1000)).toBe(true);
  expect(limit.allow("a", 1500)).toBe(false);
  expect(limit.allow("a", 2000)).toBe(true);
});
it("caps and jitters exponential retries", () => {
  expect(retryDelay(0, () => 0)).toBe(375);
  expect(retryDelay(0, () => 1)).toBe(625);
  expect(retryDelay(999, () => 0.5)).toBe(30_000);
});
