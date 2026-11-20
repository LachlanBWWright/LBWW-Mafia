import { allRoles } from "./rolesList";

export type ChatSuggestion = { label: string; kind: "Player" | "Role" | "Action" };
export type SuggestionQuery = { start: number; end: number; query: string };
const actions = ["Vote", "Abstain", "Protect", "Investigate", "Visit", "Whisper", "Claim", "Suspect"];

/** Only suggest information already public or visible to the current player. */
export function chatSuggestions(players: readonly { name: string }[], ownRole?: string): ChatSuggestion[] {
  const values: ChatSuggestion[] = [
    ...players.map(({ name }) => ({ label: name, kind: "Player" as const })),
    ...[...allRoles.map((role) => role.name), ...(ownRole ? [ownRole] : [])].map((label) => ({ label, kind: "Role" as const })),
    ...actions.map((label) => ({ label, kind: "Action" as const })),
  ];
  const seen = new Set<string>();
  return values.filter(({ label, kind }) => {
    const key = `${kind}:${label.toLowerCase()}`;
    if (!label.trim() || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function suggestionQuery(text: string, cursor: number): SuggestionQuery | null {
  if (cursor < 0 || cursor > text.length) return null;
  const before = text.slice(0, cursor);
  const match = /(?:^|\s)\/([\p{L}\p{N}_-]*(?: [\p{L}\p{N}_-]*)*)$/u.exec(before);
  if (!match) return null;
  const start = cursor - match[1]!.length - 1;
  const remainder = /^[\p{L}\p{N}_-]*/u.exec(text.slice(cursor))?.[0] ?? "";
  return { start, end: cursor + remainder.length, query: match[1]!.toLocaleLowerCase() };
}

export function filterChatSuggestions(options: readonly ChatSuggestion[], query: string): ChatSuggestion[] {
  if (!query) return [
    ...options.filter((option) => option.kind === "Player").slice(0, 3),
    ...options.filter((option) => option.kind === "Role").slice(0, 3),
    ...options.filter((option) => option.kind === "Action").slice(0, 2),
  ];
  return options.filter((option) => option.label.toLocaleLowerCase().includes(query)).slice(0, 8);
}

export function insertChatSuggestion(text: string, query: SuggestionQuery, label: string) {
  const suffix = text.slice(query.end);
  const inserted = `${label}${!suffix || !/^\s/u.test(suffix) ? " " : ""}`;
  const result = text.slice(0, query.start) + inserted + suffix;
  if (result.length > 150) return null;
  return { text: result, cursor: query.start + inserted.length };
}
