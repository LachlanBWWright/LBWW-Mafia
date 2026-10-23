import type { MatchHistoryEvent } from "../trpc/validators";
/** Remove events mentioning an erased identity; free-form chat can contain personal data. */
export function anonymizeHistory(
  events: MatchHistoryEvent[],
  aliases: ReadonlySet<string>,
): MatchHistoryEvent[] {
  return events.map((event) => {
    const actorRemoved = event.actor !== undefined && aliases.has(event.actor);
    const targetRemoved =
      event.target !== undefined && aliases.has(event.target);
    const mentioned = [...aliases].some(
      (alias) => alias.length > 0 && event.content.includes(alias),
    );
    return {
      ...event,
      ...(actorRemoved ? { actor: "Deleted player" } : {}),
      ...(targetRemoved ? { target: "Deleted player" } : {}),
      content:
        actorRemoved || targetRemoved || mentioned
          ? "[Removed]"
          : event.content,
    };
  });
}
