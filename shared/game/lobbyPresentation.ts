import type { LobbyState } from "./lobbyState";
import type { LobbyMessage } from "./matchExperience";
import { MessageKey } from "../communication/messages";

export type LobbyTab = "chat" | "players" | "group";
export type LobbyTabContext = {
  scope: string;
  ended: boolean;
  groupAvailable: boolean;
};
export type LobbyTabSelection = LobbyTabContext & { tab: LobbyTab };

/** Match/participation changes invalidate the old choice; ordinary updates do not. */
export function resolveLobbyTab(
  selection: LobbyTabSelection | undefined,
  context: LobbyTabContext,
): LobbyTab {
  const tab =
    selection?.scope === context.scope && selection.ended === context.ended
      ? selection.tab
      : context.ended
        ? "players"
        : "chat";
  return tab === "group" &&
    (!context.groupAvailable || !selection?.groupAvailable)
    ? "chat"
    : tab;
}

export function lobbyPhaseLabel(
  lobby: Pick<LobbyState, "ended" | "started" | "time" | "dayNumber">,
) {
  return lobby.ended
    ? "Match complete"
    : !lobby.started
      ? "Waiting for players"
      : `${lobby.time} ${lobby.dayNumber}`;
}

export function chatMessagePresentation(
  message: LobbyMessage,
  previous?: LobbyMessage,
) {
  return {
    grouped:
      message.kind === "chat" &&
      Boolean(message.sender) &&
      previous?.sender === message.sender &&
      previous?.kind === message.kind,
    text:
      message.kind === "chat" &&
      message.sender &&
      message.text.startsWith(`${message.sender}: `)
        ? message.text.slice(message.sender.length + 2)
        : message.text,
  };
}

/** Classify trusted server messages, never player-authored text. */
export function chatEventStyle(message: LobbyMessage): "phase-day" | "phase-night" | "death" | "vote" | "result" | "outcome" | "ordinary" {
  if (message.kind !== "system" && message.kind !== "role") return "ordinary";
  switch (message.messageKey) {
    case MessageKey.Day1Started:
    case MessageKey.DayNStarted: return "phase-day";
    case MessageKey.Night1Started:
    case MessageKey.NightNStarted: return "phase-night";
    case MessageKey.PlayerHasDied:
    case MessageKey.PlayerDiedHidden:
    case MessageKey.PlayerDiedFaction:
    case MessageKey.PlayerVotedOutByTown:
    case MessageKey.YouHaveDied:
    case MessageKey.YouHaveBeenVotedOut:
    case MessageKey.ConfeserVotedOut: return "death";
    case MessageKey.VoteCastSingleVote:
    case MessageKey.VoteCastMultipleVotes: return "vote";
    case MessageKey.FactionWon:
    case MessageKey.GameEndedDraw:
    case MessageKey.GameEndedNobodyDied:
    case MessageKey.NeutralPlayersWon: return "outcome";
    case MessageKey.ActionNotConfirmed:
    case MessageKey.ActionStale:
    case MessageKey.YouWereRoleblocked:
    case MessageKey.AttackedButSurvived: return "result";
    default: return message.kind === "role" ? "result" : "ordinary";
  }
}

/** Use specific verbs only for roles whose visit has an unambiguous meaning. */
export function roleVisitLabel(
  role: string | undefined,
  time: LobbyState["time"],
): string {
  if (time === "Night") {
    if (role === "Doctor") return "Protect";
    if (role === "Investigator") return "Investigate";
  }
  return "Visit";
}
