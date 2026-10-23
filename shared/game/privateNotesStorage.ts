import type { PrivateNotesStorage } from "./privateNotes";
import { PRIVATE_STORAGE_LIMIT } from "./privateNotes";
// SecureStore has a small native value limit. Each chunk is below 2 KiB even for Unicode.
const CHUNK_SIZE = 350;
const MAX_CHUNKS = Math.ceil(PRIVATE_STORAGE_LIMIT / (CHUNK_SIZE - 1));
export function chunkedPrivateNotesStorage(
  storage: PrivateNotesStorage,
): PrivateNotesStorage {
  async function count(key: string) {
    const raw = await storage.getItem(key);
    const value = Number(raw);
    return raw && Number.isInteger(value) && value > 0 && value <= MAX_CHUNKS
      ? value
      : 0;
  }
  return {
    async getItem(key) {
      const length = await count(key);
      if (!length) return null;
      const chunks = await Promise.all(
        Array.from({ length }, (_, index) =>
          storage.getItem(`${key}_${index}`),
        ),
      );
      return chunks.every((chunk) => chunk !== null) ? chunks.join("") : null;
    },
    async setItem(key, value) {
      if (value.length > PRIVATE_STORAGE_LIMIT)
        throw new Error("Private notes exceed the allowed limits.");
      const previous = await count(key);
      const chunks: string[] = [];
      let chunk = "";
      // Iterate code points: slicing UTF-16 can split an emoji and corrupt native UTF-8 storage.
      for (const point of value) {
        if (chunk.length + point.length > CHUNK_SIZE) {
          chunks.push(chunk);
          chunk = "";
        }
        chunk += point;
      }
      if (chunk) chunks.push(chunk);
      const length = chunks.length;
      for (const [index, raw] of chunks.entries())
        await storage.setItem(`${key}_${index}`, raw);
      await storage.setItem(key, String(length));
      for (let index = length; index < previous; index++)
        await storage.removeItem(`${key}_${index}`);
    },
    async removeItem(key) {
      const length = await count(key);
      await storage.removeItem(key);
      for (let index = 0; index < length; index++)
        await storage.removeItem(`${key}_${index}`);
    },
  };
}
