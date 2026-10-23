import { expect, it, vi } from "vitest";
vi.mock("~/server/db", () => ({ db: {} }));
vi.mock("~/env", () => ({ env: {} }));
import { readJson } from "./requests";
it("rejects chunked bodies over the limit without trusting content length", async () => {
  const request = new Request("http://test", {
    method: "POST",
    body: JSON.stringify({ value: "x".repeat(100) }),
  });
  await expect(readJson(request, 16)).rejects.toThrow("too large");
});
it("reads JSON within the limit and releases the body", async () => {
  const request = new Request("http://test", {
    method: "POST",
    body: JSON.stringify({ value: "ok" }),
  });
  expect(await readJson(request)).toEqual({ value: "ok" });
  expect(request.bodyUsed).toBe(true);
});
it("rejects a stalled body even when its received prefix is valid JSON", async () => {
  vi.useFakeTimers();
  try {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"value":"ok"}'));
      },
    });
    const request = new Request("http://test", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);
    const result = expect(readJson(request)).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
  } finally {
    vi.useRealTimers();
  }
});
