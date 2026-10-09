import { afterEach, describe, expect, it, vi } from "vitest";
import { createMessageStream } from "./stream";
describe("message stream lifecycle", () => {
  afterEach(() => vi.useRealTimers());
  it("clears subscriptions and timers when a reader cancels", async () => {
    vi.useFakeTimers();
    const unsubscribe = vi.fn();
    const stream = createMessageStream(
      new AbortController().signal,
      async () => unsubscribe,
    );
    const reader = stream.getReader();
    await reader.read();
    expect(vi.getTimerCount()).toBe(2);
    await reader.cancel();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cleans up a subscription that finishes after abort", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const unsubscribe = vi.fn();
    let complete!: (value: () => void) => void;
    const stream = createMessageStream(
      controller.signal,
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    controller.abort();
    complete(unsubscribe);
    await stream.getReader().read();
    await Promise.resolve();
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
