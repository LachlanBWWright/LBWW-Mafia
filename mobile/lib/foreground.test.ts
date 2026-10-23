import { afterEach, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({
  currentState: "active",
  addEventListener: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("react-native", () => ({ AppState: native }));
import { runInForeground } from "./foreground";
afterEach(() => vi.useRealTimers());
it("pauses native presence/polling in the background and refreshes on resume", () => {
  vi.useFakeTimers();
  native.addEventListener.mockReturnValue({ remove: native.remove });
  const send = vi.fn();
  const stop = runInForeground(send, 30_000);
  const change = native.addEventListener.mock.calls[0]![1] as (
    state: string,
  ) => void;
  expect(send).toHaveBeenCalledTimes(1);
  change("background");
  vi.advanceTimersByTime(90_000);
  expect(send).toHaveBeenCalledTimes(1);
  change("active");
  expect(send).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(30_000);
  expect(send).toHaveBeenCalledTimes(3);
  stop();
  expect(native.remove).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
