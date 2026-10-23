/** Platform-safe persistence key: room, participation and account never share a seat secret. */
export function roomResumeStorageKey(
  roomId: string,
  mode: "player" | "spectator",
  accountId = "guest",
) {
  const input = JSON.stringify([roomId, mode, accountId]);
  let first = 2166136261;
  let second = 5381;
  for (const character of input) {
    const code = character.charCodeAt(0);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `mafia_resume_${(first >>> 0).toString(16)}_${(second >>> 0).toString(16)}`;
}
