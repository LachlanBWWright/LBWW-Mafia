import type { MatchHistoryEvent } from "../trpc/validators";

export type ReplayFilter = "all" | "decisions" | "conversation";
export const REPLAY_FILTERS: { value: ReplayFilter; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "decisions", label: "Votes & actions" },
  { value: "conversation", label: "Conversation" },
];
export function filterReplayEvents(
  events: MatchHistoryEvent[],
  filter: ReplayFilter,
) {
  return events.filter(
    (event) =>
      filter === "all" ||
      (filter === "conversation"
        ? event.type === "chat" || event.type === "whisper"
        : event.type === "action" || event.type === "system"),
  );
}
export function replayEventLabel(event: MatchHistoryEvent): string {
  if (event.type === "whisper")
    return `${event.actor} → ${event.target} · Whisper`;
  if (event.type === "chat") return event.actor;
  const action =
    event.kind === "vote"
      ? "Vote"
      : event.kind === "night_action"
        ? "Night action"
        : "Action";
  if (event.type === "action")
    return `${event.actor}${event.target ? ` → ${event.target}` : ""} · ${action}`;
  const label =
    event.kind === "death"
      ? "Elimination"
      : event.kind === "outcome"
        ? "Outcome"
        : event.kind === "role_reveal"
          ? "Role reveal"
          : "Game event";
  return event.phase
    ? `${label} · ${event.phase}${event.day === undefined ? "" : ` ${event.day}`}`
    : label;
}
export function formatWinRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
export function matchOutcome(faction: string): string {
  return !faction || /^(none|draw|tie)$/i.test(faction)
    ? "Draw"
    : `${faction} won`;
}
