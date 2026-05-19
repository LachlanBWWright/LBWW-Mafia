import { afterEach, describe, expect, it, vi } from "vitest";
import { PhaseScheduler } from "./phaseScheduler.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("PhaseScheduler", () => {
  it("runs scheduled callbacks after the configured delay", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const scheduler = new PhaseScheduler(() => false);

    scheduler.schedule(1_000, callback);
    vi.advanceTimersByTime(999);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("ignores scheduled callbacks when the room state says to ignore them", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const scheduler = new PhaseScheduler(() => true);

    scheduler.schedule(1_000, callback);
    vi.advanceTimersByTime(1_000);

    expect(callback).not.toHaveBeenCalled();
  });

  it("cancels all scheduled callbacks", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const scheduler = new PhaseScheduler(() => false);

    scheduler.schedule(1_000, callback);
    scheduler.schedule(2_000, callback);
    scheduler.cancelAll();
    vi.advanceTimersByTime(2_000);

    expect(callback).not.toHaveBeenCalled();
  });
});
