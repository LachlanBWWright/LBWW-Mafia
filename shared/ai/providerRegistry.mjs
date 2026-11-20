import { fail } from "./providerError.mjs";

/** Registry belongs to the host; no global mutation or provider-name switches. */
export function createProviderRegistry(adapters) {
  const entries = new Map();
  for (const adapter of adapters) {
    if (
      !adapter ||
      typeof adapter.id !== "string" ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(adapter.id) ||
      typeof adapter.create !== "function"
    )
      throw fail(
        "configuration",
        "Provider adapters require an ID and create function.",
      );
    if (entries.has(adapter.id))
      throw fail("configuration", "Provider adapter IDs must be unique.");
    entries.set(adapter.id, Object.freeze({ ...adapter }));
  }
  return Object.freeze({
    get(id) {
      const adapter = entries.get(id);
      if (!adapter)
        throw fail("configuration", "Choose a registered API provider.");
      return adapter;
    },
    ids() {
      return [...entries.keys()];
    },
  });
}
