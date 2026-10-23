type ResumeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  randomUUID: () => string;
};

export const browserResumeStorage: ResumeStorage = {
  getItem: (key) => window.sessionStorage.getItem(key),
  setItem: (key, value) => window.sessionStorage.setItem(key, value),
  randomUUID: () => crypto.randomUUID(),
};

export const noServerResumeIdentity = () => undefined;

/** Construction and snapshots are pure; browser persistence starts on subscription. */
export function createResumeIdentityStore(
  storageKey: string,
  enabled: boolean,
  storage: ResumeStorage = browserResumeStorage,
) {
  let resumeKey: string | undefined;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => resumeKey,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (enabled && !resumeKey) {
        try {
          resumeKey = storage.getItem(storageKey) ?? storage.randomUUID();
          storage.setItem(storageKey, resumeKey);
        } catch {
          // Storage may be blocked; keep the seat identity for this mounted lobby.
          resumeKey ??= storage.randomUUID();
        }
        for (const notify of listeners) notify();
      }
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
