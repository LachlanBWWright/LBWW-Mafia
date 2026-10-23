/** Local-only data: never add this contract to game snapshots, bot prompts or replay exports. */
export const PRIVATE_NOTE_LIMIT = 4000;
export const PRIVATE_FIELD_LIMIT = 400;
export const PRIVATE_BOARD_LIMIT = 40;
export const PRIVATE_STORAGE_LIMIT = 60_000;
export type Suspicion = "unknown" | "trusted" | "suspicious";
export type PrivatePlayerNote = {
  name: string;
  suspicion: Suspicion;
  claim: string;
  confirmedFact: string;
};
export type PrivateNotes = {
  version: 1;
  matchId: string;
  playerName: string;
  ownerId: string;
  notes: string;
  board: PrivatePlayerNote[];
};
export type PrivateNotesLobby = {
  matchId?: string;
  playerName: string;
  players: { name: string }[];
};
export function emptyPrivateNotes(
  matchId: string,
  playerName: string,
  ownerId = "guest",
): PrivateNotes {
  return { version: 1, matchId, playerName, ownerId, notes: "", board: [] };
}
export function privateNotesKey(
  matchId: string,
  playerName: string,
  ownerId = "guest",
): string {
  const identity = JSON.stringify([matchId, playerName, ownerId]);
  let first = 2166136261;
  let second = 5381;
  for (let i = 0; i < identity.length; i++) {
    first = Math.imul(first ^ identity.charCodeAt(i), 16777619);
    second = Math.imul(second, 33) ^ identity.charCodeAt(i);
  }
  return `mafia_private_notes_${(first >>> 0).toString(16)}_${(second >>> 0).toString(16)}`;
}
export function decodePrivateNotes(
  raw: string | null,
  matchId: string,
  playerName: string,
  ownerId = "guest",
): PrivateNotes {
  const empty = emptyPrivateNotes(matchId, playerName, ownerId);
  if (!raw || raw.length > PRIVATE_STORAGE_LIMIT) return empty;
  try {
    const value = JSON.parse(raw) as Partial<PrivateNotes>;
    if (
      value.version !== 1 ||
      value.matchId !== matchId ||
      value.playerName !== playerName ||
      value.ownerId !== ownerId ||
      typeof value.notes !== "string" ||
      value.notes.length > PRIVATE_NOTE_LIMIT ||
      !Array.isArray(value.board) ||
      value.board.length > PRIVATE_BOARD_LIMIT
    )
      return empty;
    const names = new Set<string>();
    for (const row of value.board) {
      if (
        !row ||
        typeof row.name !== "string" ||
        !row.name ||
        row.name.length > 200 ||
        names.has(row.name) ||
        !["unknown", "trusted", "suspicious"].includes(row.suspicion) ||
        typeof row.claim !== "string" ||
        row.claim.length > PRIVATE_FIELD_LIMIT ||
        typeof row.confirmedFact !== "string" ||
        row.confirmedFact.length > PRIVATE_FIELD_LIMIT
      )
        return empty;
      names.add(row.name);
    }
    // Copy allowed fields only; arbitrary persisted properties cannot enter the editor.
    return {
      ...empty,
      notes: value.notes,
      board: value.board.map(({ name, suspicion, claim, confirmedFact }) => ({
        name,
        suspicion,
        claim,
        confirmedFact,
      })),
    };
  } catch {
    return empty;
  }
}
export function updatePrivatePlayer(
  notes: PrivateNotes,
  name: string,
  patch: Partial<Omit<PrivatePlayerNote, "name">>,
): PrivateNotes {
  if (!name || name.length > 200) return notes;
  const existing = notes.board.find((row) => row.name === name);
  if (!existing && notes.board.length >= PRIVATE_BOARD_LIMIT) return notes;
  const row: PrivatePlayerNote = {
    name,
    suspicion: "unknown",
    claim: "",
    confirmedFact: "",
    ...existing,
    ...patch,
  };
  row.claim = row.claim.slice(0, PRIVATE_FIELD_LIMIT);
  row.confirmedFact = row.confirmedFact.slice(0, PRIVATE_FIELD_LIMIT);
  return {
    ...notes,
    board: [...notes.board.filter((item) => item.name !== name), row],
  };
}
export interface PrivateNotesStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
/** Serializes writes so rapid edits/clear cannot leave an older revision persisted. */
export function createPrivateNotesRepository(storage: PrivateNotesStorage) {
  let writes = Promise.resolve();
  return {
    async load(matchId: string, playerName: string, ownerId = "guest") {
      await writes.catch(() => undefined);
      return decodePrivateNotes(
        await storage.getItem(privateNotesKey(matchId, playerName, ownerId)),
        matchId,
        playerName,
        ownerId,
      );
    },
    save(value: PrivateNotes) {
      const raw = JSON.stringify(value);
      if (
        raw.length > PRIVATE_STORAGE_LIMIT ||
        JSON.stringify(
          decodePrivateNotes(
            raw,
            value.matchId,
            value.playerName,
            value.ownerId,
          ),
        ) !== raw
      )
        return Promise.reject(
          new Error("Private notes exceed the allowed limits."),
        );
      writes = writes
        .catch(() => undefined)
        .then(() =>
          storage.setItem(
            privateNotesKey(value.matchId, value.playerName, value.ownerId),
            raw,
          ),
        );
      return writes;
    },
    clear(matchId: string, playerName: string, ownerId = "guest") {
      writes = writes
        .catch(() => undefined)
        .then(() =>
          storage.removeItem(privateNotesKey(matchId, playerName, ownerId)),
        );
      return writes;
    },
  };
}
