import { afterEach, expect, it, vi } from "vitest";
import { HistoryOutbox } from "./historyOutbox.js";
const input = {
  gameId: "room:game",
  roomName: "room",
  startedAt: new Date(),
  endedAt: new Date(),
  winningFaction: "draw",
  winningRoles: [],
  participants: [],
  conversationHistory: [],
  actionHistory: [],
};
afterEach(() => vi.unstubAllGlobals());
it("retains failed uploads durably and drains them from a new host", async () => {
  const values = new Map<string, unknown>();
  const storage = {
    get: async <T>(key: string) => values.get(key) as T | undefined,
    put: async (key: string, value: unknown) => {
      values.set(key, structuredClone(value));
    },
    delete: async (key: string) => values.delete(key),
    setAlarm: vi.fn(async () => undefined),
  };
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("network down"))
    .mockResolvedValueOnce(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  const backend = { url: "https://web.test", secret: "secret" };
  await new HistoryOutbox(storage, backend).enqueue(input);
  expect(values.has("pending-history")).toBe(true);
  expect(storage.setAlarm).toHaveBeenCalledTimes(2);
  await new HistoryOutbox(storage, backend).drain();
  expect(values.has("pending-history")).toBe(false);
  expect(JSON.parse(fetch.mock.calls[0]![1].body)["0"].json.gameId).toBe(
    input.gameId,
  );
});

it("chunks large histories and restores every entry without oversize storage values", async () => {
  const values = new Map<string, unknown>();
  const storage = {
    get: async <T>(key: string) => values.get(key) as T | undefined,
    put: async (key: string, value: unknown) => {
      values.set(key, value);
    },
    putBatch: vi.fn(async (batch: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(batch)) {
        expect(
          new TextEncoder().encode(JSON.stringify(value)).byteLength,
        ).toBeLessThan(100_000);
        values.set(key, value);
      }
    }),
    delete: async (key: string) => values.delete(key),
    setAlarm: async () => undefined,
  };
  const fetch = vi.fn<typeof globalThis.fetch>(
    async () => new Response(null, { status: 200 }),
  );
  vi.stubGlobal("fetch", fetch);
  const history = Array.from({ length: 1000 }, () => ({
    time: 1,
    type: "chat" as const,
    content: "\u0000".repeat(150),
  }));
  await new HistoryOutbox(storage, {
    url: "https://web.test",
    secret: "secret",
  }).enqueue({ ...input, conversationHistory: history });
  expect(storage.putBatch).toHaveBeenCalledOnce();
  expect(
    Object.keys(storage.putBatch.mock.calls[0]![0]).length,
  ).toBeGreaterThan(2);
  expect(
    JSON.parse(fetch.mock.calls[0]![1]!.body as string)["0"].json
      .conversationHistory,
  ).toEqual(history);
  expect(values.size).toBe(0);
});
