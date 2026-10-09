import {
  persistMatchHistory,
  type BackendContext,
  type MatchHistoryInput,
} from "./matchHistory.js";
import { retryDelay } from "../../shared/reliability/limits.js";
type Pending = {
  input?: Omit<MatchHistoryInput, "startedAt" | "endedAt"> & {
    startedAt: string;
    endedAt: string;
  };
  attempts: number;
  parts?: number;
  gameId?: string;
};
export type OutboxStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<unknown>;
  putBatch?: (values: Record<string, unknown>) => Promise<unknown>;
  delete(key: string): Promise<unknown>;
  setAlarm(at: number): Promise<unknown>;
};
/** A completed result is saved before upload. Durable alarms survive host replacement. */
export class HistoryOutbox {
  private running?: Promise<void>;
  constructor(
    private storage: OutboxStorage,
    private backend: BackendContext,
  ) {}
  async enqueue(input: MatchHistoryInput) {
    const serialized = JSON.stringify({
      ...input,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt.toISOString(),
    });
    const values: Record<string, unknown> = {};
    const parts = Math.ceil(serialized.length / 16384);
    for (let index = 0; index < parts; index++)
      values[`history-part:${index}`] = serialized.slice(
        index * 16384,
        (index + 1) * 16384,
      );
    values["pending-history"] = { parts, gameId: input.gameId, attempts: 0 };
    // Arm recovery before the atomic batch. Each value remains small.
    await this.storage.setAlarm(Date.now() + 1000);
    if (this.storage.putBatch) await this.storage.putBatch(values);
    else
      for (const [key, value] of Object.entries(values))
        await this.storage.put(key, value);
    await this.drain();
  }
  drain() {
    return (this.running ??= this.upload().finally(() => {
      this.running = undefined;
    }));
  }
  private async upload() {
    const pending = await this.storage.get<Pending>("pending-history");
    if (!pending) return;
    try {
      let input = pending.input;
      if (!input) {
        const chunks = await Promise.all(
          Array.from({ length: pending.parts ?? 0 }, (_, index) =>
            this.storage.get<string>(`history-part:${index}`),
          ),
        );
        if (chunks.some((chunk) => chunk === undefined))
          throw new Error("History chunk missing");
        input = JSON.parse(chunks.join("")) as NonNullable<Pending["input"]>;
      }
      await persistMatchHistory(
        {
          ...input,
          startedAt: new Date(input.startedAt),
          endedAt: new Date(input.endedAt),
        },
        this.backend,
      );
      await this.storage.delete("pending-history");
      for (let index = 0; index < (pending.parts ?? 0); index++)
        await this.storage.delete(`history-part:${index}`);
      console.info(
        JSON.stringify({
          event: "history.persisted",
          gameId: pending.gameId ?? pending.input?.gameId,
          attempts: pending.attempts + 1,
        }),
      );
    } catch {
      pending.attempts++;
      await this.storage.put("pending-history", pending);
      await this.storage.setAlarm(Date.now() + retryDelay(pending.attempts));
      console.error(
        JSON.stringify({
          event: "history.retry",
          gameId: pending.gameId ?? pending.input?.gameId,
          attempts: pending.attempts,
        }),
      );
    }
  }
}
