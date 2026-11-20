import type { GameSnapshot } from "../communication/events";
import { describeCustomRole } from "./customRoles";

export function publicSetupLines(
  setup: NonNullable<GameSnapshot["setup"]>,
): string[] {
  const r = setup.rules;
  return [
    `Opening ${r.timing.firstDaySeconds}s · day ${r.timing.daySeconds}s · night ${r.timing.nightSeconds}s${r.timing.earlyEnd ? " · finish when everyone submits" : ""}`,
    `${r.voting.method === "majority" ? "Majority" : "Plurality"} vote · ${setup.voteVisibility === "hidden" ? "anonymous" : "public"} ballots · ${r.voting.allowRevote ? "votes can change" : "votes are final"}`,
    `Ties ${r.voting.tie === "random" ? "eliminate a random tied player" : "spare everyone"} · death reveals ${r.reveal.onDeath}`,
    `Whispers ${r.communication.whispers ? "on" : "off"} · ${r.communication.messageLimit || "unlimited"} messages per phase · last words ${r.communication.lastWords ? "on" : "off"}`,
    `Spectator chat ${r.communication.observerChat ? "on" : "off"}${r.bots.fillEmptySeats ? ` · built-in bots: ${r.bots.difficulty}, ${r.bots.personality}` : ""}`,
    ...(setup.rolePool ? [`Possible roles: ${setup.rolePool.join(", ")}`] : []),
    ...(setup.customRoles?.map(describeCustomRole) ?? []),
  ];
}

export function gameThemeColors(
  theme: "classic" | "noir" | "midnight" | undefined,
) {
  return theme === "noir"
    ? { background: "#191715", foreground: "#faf3e8", accent: "#e6bb78" }
    : theme === "midnight"
      ? { background: "#0e1830", foreground: "#edf2ff", accent: "#a9b7ff" }
      : undefined;
}
