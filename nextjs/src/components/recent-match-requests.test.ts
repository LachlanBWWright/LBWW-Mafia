import { describe, expect, it, vi } from "vitest";
import {
  recentMatchIdentity,
  startHistoryRequest,
} from "./recent-match-requests";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("history lookup identity", () => {
  it("separates username and authenticated lookups while ignoring irrelevant input", () => {
    expect(recentMatchIdentity(" alice ", false)).toBe(
      recentMatchIdentity("alice", false),
    );
    expect(recentMatchIdentity("alice", false)).not.toBe(
      recentMatchIdentity("bob", false),
    );
    expect(recentMatchIdentity("alice", false)).not.toBe(
      recentMatchIdentity("alice", true),
    );
    expect(recentMatchIdentity("alice", true)).toBe(
      recentMatchIdentity("bob", true),
    );
    expect(recentMatchIdentity(" ", false)).toBe(
      recentMatchIdentity("", false),
    );
  });
});

describe("history request lifecycle", () => {
  it("ignores an older response after a new lookup finishes, even without transport cancellation", async () => {
    const older = deferred<string>();
    const newer = deferred<string>();
    const success = vi.fn();
    const error = vi.fn();
    const settled = vi.fn();
    let firstSignal: AbortSignal | undefined;
    const dispose = startHistoryRequest(
      (signal) => {
        firstSignal = signal;
        return older.promise;
      },
      success,
      error,
      "Failed",
      settled,
    );
    dispose();
    startHistoryRequest(() => newer.promise, success, error, "Failed", settled);
    newer.resolve("Bob's history");
    await newer.promise;
    older.resolve("Alice's history");
    await older.promise;
    expect(firstSignal?.aborted).toBe(true);
    expect(success).toHaveBeenCalledExactlyOnceWith("Bob's history");
    expect(error).not.toHaveBeenCalled();
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("does not publish a late rejection or completion after unmount", async () => {
    const response = deferred<string>();
    const success = vi.fn();
    const error = vi.fn();
    const settled = vi.fn();
    const dispose = startHistoryRequest(
      () => response.promise,
      success,
      error,
      "Failed",
      settled,
    );
    dispose();
    dispose();
    response.reject(new Error("Old request failed"));
    await response.promise.catch(() => undefined);
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(settled).not.toHaveBeenCalled();
  });

  it("does not publish a successful response after unmount", async () => {
    const response = deferred<number[]>();
    const success = vi.fn();
    const error = vi.fn();
    const settled = vi.fn();
    const dispose = startHistoryRequest(
      () => response.promise,
      success,
      error,
      "Failed",
      settled,
    );
    dispose();
    response.resolve([1, 2]);
    await response.promise;
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(settled).not.toHaveBeenCalled();
  });

  it.each([
    [new Error("Not authorized"), "Not authorized"],
    ["unknown rejection", "Could not load history"],
  ])(
    "publishes a current failure and clears loading",
    async (reason, message) => {
      const response = deferred<string>();
      const success = vi.fn();
      const error = vi.fn();
      const settled = vi.fn();
      startHistoryRequest(
        () => response.promise,
        success,
        error,
        "Could not load history",
        settled,
      );
      response.reject(reason);
      await response.promise.catch(() => undefined);
      expect(success).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledExactlyOnceWith(message);
      expect(settled).toHaveBeenCalledTimes(1);
    },
  );

  it("handles synchronous request setup failures", () => {
    const error = vi.fn();
    const settled = vi.fn();
    startHistoryRequest(
      () => {
        throw new Error("Client unavailable");
      },
      vi.fn(),
      error,
      "Failed",
      settled,
    );
    expect(error).toHaveBeenCalledExactlyOnceWith("Client unavailable");
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it("treats empty results as a successful loaded history", async () => {
    const response = deferred<never[]>();
    const success = vi.fn();
    const settled = vi.fn();
    startHistoryRequest(
      () => response.promise,
      success,
      vi.fn(),
      "Failed",
      settled,
    );
    response.resolve([]);
    await response.promise;
    expect(success).toHaveBeenCalledExactlyOnceWith([]);
    expect(settled).toHaveBeenCalledTimes(1);
  });
});
