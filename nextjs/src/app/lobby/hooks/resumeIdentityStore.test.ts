import { describe, expect, it, vi } from "vitest";
import { roomResumeStorageKey } from "@mernmafia/shared/game/resumeIdentity";
import {
  createResumeIdentityStore,
  noServerResumeIdentity,
} from "./resumeIdentityStore";

function memoryStorage() {
  const entries = new Map<string, string>();
  let sequence = 0;
  return {
    entries,
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value);
    }),
    randomUUID: vi.fn(() => `identity-${++sequence}`),
  };
}

describe("browser resume identity store", () => {
  it("does not access browser persistence during construction, render snapshots or SSR", () => {
    const storage = memoryStorage();
    const store = createResumeIdentityStore("room", true, storage);
    expect(store.getSnapshot()).toBeUndefined();
    expect(store.getSnapshot()).toBeUndefined();
    expect(noServerResumeIdentity()).toBeUndefined();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.randomUUID).not.toHaveBeenCalled();
    // The default adapter also remains safe without window in server rendering.
    expect(
      createResumeIdentityStore("server", true).getSnapshot(),
    ).toBeUndefined();
  });

  it("initializes on subscription and preserves the same key across StrictMode resubscription", () => {
    const storage = memoryStorage();
    const store = createResumeIdentityStore("room", true, storage);
    const notify = vi.fn();
    const unsubscribe = store.subscribe(notify);
    expect(store.getSnapshot()).toBe("identity-1");
    expect(storage.entries.get("room")).toBe("identity-1");
    expect(notify).toHaveBeenCalledTimes(1);
    unsubscribe();
    unsubscribe();
    const secondNotify = vi.fn();
    store.subscribe(secondNotify);
    expect(store.getSnapshot()).toBe("identity-1");
    expect(storage.randomUUID).toHaveBeenCalledTimes(1);
    expect(secondNotify).not.toHaveBeenCalled();
  });

  it("reuses a persisted seat after remount", () => {
    const storage = memoryStorage();
    storage.entries.set("room", "existing-seat");
    const store = createResumeIdentityStore("room", true, storage);
    store.subscribe(vi.fn());
    expect(store.getSnapshot()).toBe("existing-seat");
    expect(storage.randomUUID).not.toHaveBeenCalled();
    const remounted = createResumeIdentityStore("room", true, storage);
    remounted.subscribe(vi.fn());
    expect(remounted.getSnapshot()).toBe("existing-seat");
  });

  it("keeps room, account and participation identities isolated", () => {
    const storage = memoryStorage();
    const identities = [
      roomResumeStorageKey("room-a", "player", "alice"),
      roomResumeStorageKey("room-b", "player", "alice"),
      roomResumeStorageKey("room-a", "spectator", "alice"),
      roomResumeStorageKey("room-a", "player", "bob"),
    ].map((key) => {
      const store = createResumeIdentityStore(key, true, storage);
      store.subscribe(vi.fn());
      return store.getSnapshot();
    });
    expect(new Set(identities).size).toBe(4);
  });

  it("does no persistence work for practice or unavailable server configuration", () => {
    const storage = memoryStorage();
    const store = createResumeIdentityStore("practice", false, storage);
    store.subscribe(vi.fn());
    expect(store.getSnapshot()).toBeUndefined();
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.randomUUID).not.toHaveBeenCalled();
  });

  it("keeps a stable ephemeral identity when storage reads are blocked", () => {
    const storage = memoryStorage();
    storage.getItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    const store = createResumeIdentityStore("room", true, storage);
    const unsubscribe = store.subscribe(vi.fn());
    expect(store.getSnapshot()).toBe("identity-1");
    unsubscribe();
    store.subscribe(vi.fn());
    expect(store.getSnapshot()).toBe("identity-1");
    expect(storage.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("preserves the retrieved key when storage writes fail", () => {
    const storage = memoryStorage();
    storage.entries.set("room", "existing-seat");
    storage.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    const store = createResumeIdentityStore("room", true, storage);
    store.subscribe(vi.fn());
    expect(store.getSnapshot()).toBe("existing-seat");
    expect(storage.randomUUID).not.toHaveBeenCalled();
  });

  it("preserves a freshly generated key when storage writes fail", () => {
    const storage = memoryStorage();
    storage.setItem.mockImplementation(() => {
      throw new Error("quota");
    });
    const store = createResumeIdentityStore("room", true, storage);
    store.subscribe(vi.fn());
    expect(store.getSnapshot()).toBe("identity-1");
    expect(storage.randomUUID).toHaveBeenCalledTimes(1);
  });
});
