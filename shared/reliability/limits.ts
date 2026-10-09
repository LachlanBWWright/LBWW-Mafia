/** Fixed-size token buckets for room-local commands, never shared authentication limits. */
export class CommandLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  constructor(
    private capacity = 30,
    private perSecond = 5,
  ) {}
  allow(key: string, now = Date.now()) {
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, at: now };
    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + (Math.max(0, now - bucket.at) * this.perSecond) / 1000,
    );
    bucket.at = now;
    this.buckets.set(key, bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens--;
    return true;
  }
  remove(key: string) {
    this.buckets.delete(key);
  }
}
export const MAX_SOCKET_BYTES = 16_384;
export const MAX_ROOM_CONNECTIONS = 128;
export const REQUEST_TIMEOUT_MS = 10_000;
export function retryDelay(attempt: number, random = Math.random) {
  return Math.round(
    Math.min(500 * 2 ** Math.min(attempt, 10), 30_000) *
      (0.75 + random() * 0.5),
  );
}
