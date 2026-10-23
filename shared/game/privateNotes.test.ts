import { describe, expect, it } from "vitest";
import {
  createPrivateNotesRepository,
  decodePrivateNotes,
  emptyPrivateNotes,
  PRIVATE_FIELD_LIMIT,
  PRIVATE_NOTE_LIMIT,
  privateNotesKey,
  updatePrivatePlayer,
} from "./privateNotes";
import { chunkedPrivateNotesStorage } from "./privateNotesStorage";
function memory() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: async (key: string) => {
      items.delete(key);
    },
  };
}
describe("private match notes", () => {
  it("isolates matches and identities and rejects a mismatched persisted payload", async () => {
    const store = memory();
    const repo = createPrivateNotesRepository(store);
    const value = {
      ...emptyPrivateNotes("match-a", "Alice"),
      notes: "My secret",
    };
    await repo.save(value);
    expect((await repo.load("match-a", "Alice")).notes).toBe("My secret");
    expect((await repo.load("match-b", "Alice")).notes).toBe("");
    expect((await repo.load("match-a", "Bob")).notes).toBe("");
    await repo.save({
      ...emptyPrivateNotes("match-a", "Alice", "account-a"),
      notes: "Account secret",
    });
    expect((await repo.load("match-a", "Alice", "account-b")).notes).toBe("");
    expect((await repo.load("match-a", "Alice", "account-a")).notes).toBe(
      "Account secret",
    );
    store.items.set(privateNotesKey("match-b", "Alice"), JSON.stringify(value));
    expect((await repo.load("match-b", "Alice")).notes).toBe("");
    expect(privateNotesKey("a/b 🕵️", "x/y")).toMatch(/^[a-z0-9_]+$/);
  });
  it("rejects malformed, oversized and duplicated board entries", () => {
    const value = updatePrivatePlayer(emptyPrivateNotes("m", "a"), "b", {
      claim: "Detective",
    });
    for (const raw of [
      "{",
      JSON.stringify({ ...value, notes: "x".repeat(PRIVATE_NOTE_LIMIT + 1) }),
      JSON.stringify({ ...value, board: [...value.board, ...value.board] }),
      JSON.stringify({
        ...value,
        board: [{ ...value.board[0], suspicion: "secret-role" }],
      }),
    ])
      expect(decodePrivateNotes(raw, "m", "a").board).toEqual([]);
    expect(
      updatePrivatePlayer(value, "b", { claim: "x".repeat(1000) }).board[0]
        ?.claim.length,
    ).toBe(PRIVATE_FIELD_LIMIT);
  });
  it("serializes writes and clearing so old edits cannot reappear", async () => {
    const store = memory();
    const repo = createPrivateNotesRepository(store);
    const first = repo.save({ ...emptyPrivateNotes("m", "a"), notes: "old" });
    const second = repo.save({ ...emptyPrivateNotes("m", "a"), notes: "new" });
    const clear = repo.clear("m", "a");
    await Promise.all([first, second, clear]);
    expect((await repo.load("m", "a")).notes).toBe("");
    expect(store.items.size).toBe(0);
  });
  it("stores Unicode notes in bounded native chunks and deletes all chunks", async () => {
    const store = memory();
    const repo = createPrivateNotesRepository(
      chunkedPrivateNotesStorage(store),
    );
    const value = { ...emptyPrivateNotes("m", "a"), notes: "🕵️".repeat(800) };
    await repo.save(value);
    expect(await repo.load("m", "a")).toEqual(value);
    expect(
      [...store.items.values()].every(
        (raw) => new TextEncoder().encode(raw).length < 2048,
      ),
    ).toBe(true);
    for (const raw of store.items.values())
      expect(new TextDecoder().decode(new TextEncoder().encode(raw))).toBe(raw);
    await repo.clear("m", "a");
    expect(store.items.size).toBe(0);
  });
  it("strips unexpected persisted fields so role information cannot enter local note records", () => {
    const value = updatePrivatePlayer(emptyPrivateNotes("m", "a"), "b", {
      suspicion: "trusted",
      confirmedFact: "Survived night one",
    });
    const raw = JSON.stringify({
      ...value,
      hiddenRoles: { b: "Mafia" },
      board: value.board.map((row) => ({ ...row, role: "Mafia" })),
    });
    expect(decodePrivateNotes(raw, "m", "a")).toEqual(value);
  });
});
