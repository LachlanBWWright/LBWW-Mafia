import { DayTime, type PlayerList } from "../communication/events";
import type { MessageKey } from "../communication/messages";
import { allRoles } from "./rolesList";
import { describeCustomRole, type CustomRole } from "./customRoles";
import {
  shouldShowVisitAction,
  type VisitCapability,
} from "./playerActionRules";

export type ActionSelection = {
  vote?: string | null;
  visit?: string | null;
  feedback?: string;
  outcome?: "submitted" | "blocked" | "resolved" | "rejected";
};
export type MatchTimelineEntry = {
  id: number;
  day: number;
  phase: DayTime;
  text: string;
};
export type MatchRecap = {
  winner: string;
  reason: string;
  players: { name: string; role: string; won: boolean }[];
  timeline: MatchTimelineEntry[];
};
export type MatchExperience = {
  participation?: "player" | "eliminated" | "spectator";
  spectatorCount?: number;
  capacity?: number;
  started?: boolean;
  ended?: boolean;
  action?: ActionSelection;
  timeline?: MatchTimelineEntry[];
  recap?: MatchRecap;
  readyPlayers?: string[];
  voteVisibility?: "public" | "hidden";
};
export type LobbyMessage = {
  id: number;
  text: string;
  kind?: "chat" | "whisper" | "system" | "role" | "spectator";
  sender?: string;
  isBot?: boolean;
  messageKey?: MessageKey;
};
export function roleReference(name?: string, customRoles: readonly CustomRole[] = []) {
  const role = allRoles.find(
    (entry) => entry.name.toLowerCase() === name?.toLowerCase(),
  );
  if (!role) {
    const custom = customRoles.find((entry) => entry.name.toLowerCase() === name?.toLowerCase());
    if (!custom) return undefined;
    return { name: custom.name, objective: custom.alignment === "town" ? "Help Town eliminate Mafia and other hostile factions." : "Help Mafia eliminate Town and other hostile factions.", description: [custom.description, describeCustomRole(custom)].filter(Boolean).join(" ") };
  }
  const objective =
    role.faction === "town"
      ? "Help Town eliminate Mafia and other hostile factions."
      : role.faction === "mafia"
        ? "Help Mafia eliminate Town and other hostile factions."
        : role.description;
  return { ...role, objective };
}
export function voteSummary(
  players: PlayerList[],
  visibility?: "public" | "hidden",
  method: "majority" | "plurality" = "majority",
) {
  if (visibility === "hidden") return undefined;
  const living = players.filter((player) => player.isAlive !== false);
  const highest = Math.max(
    0,
    ...living.map((player) => player.votesReceived ?? 0),
  );
  return {
    required: method === "majority" ? Math.floor(living.length / 2) + 1 : undefined,
    leaders: highest
      ? living
          .filter((player) => player.votesReceived === highest)
          .map((player) => player.name)
      : [],
    highest,
  };
}
export function formatClock(seconds: number) {
  return `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, "0")}`;
}
export function visibleMessages(messages: LobbyMessage[], muted: boolean) {
  return muted
    ? messages.filter((message) => !message.isBot || message.kind === "system")
    : messages;
}

export function phaseActionHint(input: {
  time: DayTime;
  capability: VisitCapability;
  started?: boolean;
  ended?: boolean;
  canVote: boolean;
  actorAlive?: boolean;
}) {
  if (input.ended) return "Match complete. Review the recap or play again.";
  if (input.started === false) return "Waiting for players to join.";
  if (input.actorAlive === false)
    return "You were eliminated. Follow the remaining players as a spectator.";
  const visit = shouldShowVisitAction(input.time, input.capability);
  const vote =
    input.canVote &&
    (input.time === DayTime.Day || Boolean(input.capability.nightVote));
  if (visit && vote)
    return "Choose an eligible living player to visit or cast your vote.";
  if (visit)
    return "Choose an eligible living player to visit. You can change or cancel your visit until the phase ends.";
  if (vote)
    return input.time === DayTime.Night
      ? "Choose a living player for your faction's night vote."
      : "Discuss what you know, then vote for a living player or abstain.";
  return input.time === DayTime.Night
    ? "Your role has no available night action. Wait for daybreak."
    : "You have no available action this phase. Follow the discussion.";
}

/** Derived from the player's private capabilities rather than inferred from role names. */
export function roleActionRestrictions(capability: VisitCapability) {
  const restrictions: string[] = [];
  for (const time of [DayTime.Day, DayTime.Night]) {
    if (!shouldShowVisitAction(time, capability)) continue;
    const self =
      time === DayTime.Day
        ? capability.dayVisitSelf
        : capability.nightVisitSelf;
    const others =
      time === DayTime.Day
        ? capability.dayVisitOthers
        : capability.nightVisitOthers;
    const faction =
      time === DayTime.Day
        ? capability.dayVisitFaction
        : capability.nightVisitFaction;
    if (!self) restrictions.push(`${time}: you cannot visit yourself.`);
    if (!others && !faction)
      restrictions.push(`${time}: you can only visit yourself.`);
    else if (!others)
      restrictions.push(`${time}: other targets must belong to your faction.`);
    else if (!faction)
      restrictions.push(
        `${time}: you cannot visit known members of your faction.`,
      );
  }
  if (capability.nightVote)
    restrictions.push(
      "At night, your vote selects your faction's attack target.",
    );
  return restrictions;
}

/** Room setup controls are available only to waiting players, on both clients. */
export function canConfigureAiCharacters(
  lobby: MatchExperience,
  practice = false,
) {
  return (
    !practice &&
    !lobby.started &&
    !lobby.ended &&
    lobby.participation !== "spectator" &&
    lobby.participation !== "eliminated"
  );
}

/** Name the decision behind the compact action shortcut on both clients. */
export function matchActionLabel(lobby: {
  time: DayTime;
  canVote: boolean;
  currentUserRole?: string;
  visitCapability: VisitCapability;
  action: ActionSelection;
}) {
  if (lobby.action.visit) return "View action";
  if (lobby.canVote && (lobby.time === DayTime.Day || lobby.visitCapability.nightVote)) {
    return lobby.action.vote !== undefined ? "View vote" : "Choose a vote";
  }
  if (!shouldShowVisitAction(lobby.time, lobby.visitCapability)) return "View players";
  if (lobby.time === DayTime.Night && lobby.currentUserRole === "Doctor") return "Choose who to protect";
  return "Choose a target";
}
