"use client";

import { roleVisitLabel } from "@mernmafia/shared/game/lobbyPresentation";
import type { ActionSelection } from "@mernmafia/shared/game/matchExperience";
import { Button } from "~/components/ui/button";
import { visitActionIcon } from "@mernmafia/shared/game/actionIcon";
import { ActionIcon } from "~/components/action-icon";
import type {
  DayTime,
  VisitCapability,
} from "@mernmafia/shared/game/playerActionRules";
import {
  canPerformVisit,
  canVoteTarget,
  canWhisperTarget,
  shouldShowDayOnlyActions,
  shouldShowVisitAction,
} from "@mernmafia/shared/game/playerActionRules";
import type { Player } from "./hooks/useGameLobby";
import { RoleIcon } from "~/components/role-icon";
import { PlayerAvatar } from "~/components/player-avatar";
import { NotebookPen } from "lucide-react";

type PlayerRowProps = {
  whispersEnabled?: boolean;
  started?: boolean;
  ended?: boolean;
  action?: ActionSelection;
  canAct?: boolean;
  leader?: boolean;
  recentSpeaker?: boolean;
  hasNote?: boolean;
  onNotes?: (name: string) => void;
  votesRequired?: number;
  highlighted?: boolean;
  player: Player;
  index: number;
  playerName: string;
  time: DayTime;
  isCurrentUserAlive: boolean;
  currentUserRole: string | undefined;
  visitCapability: VisitCapability;
  canVote: boolean;
  messageDraft: string;
  onVote: (index: number) => void;
  onVisit: (index: number) => void;
  onWhisper: (index: number) => void;
};

export function PlayerRow({
  whispersEnabled = true,
  started = false,
  ended = false,
  action = {},
  canAct = true,
  leader = false,
  recentSpeaker = false,
  hasNote = false,
  onNotes,
  votesRequired,
  highlighted = false,
  player,
  index,
  playerName,
  time,
  isCurrentUserAlive,
  currentUserRole,
  visitCapability,
  canVote,
  messageDraft,
  onVote,
  onVisit,
  onWhisper,
}: PlayerRowProps) {
  const selected =
    !ended && (action.visit === player.name || action.vote === player.name);
  const isDayTime = shouldShowDayOnlyActions(time);
  const showVisit = shouldShowVisitAction(time, visitCapability);
  const canVisit =
    canAct &&
    canPerformVisit({
      time,
      isSelf: player.name === playerName,
      targetAlive: player.isAlive !== false,
      actorAlive: isCurrentUserAlive,
      actorRole: currentUserRole,
      targetRole: player.role,
      capability: visitCapability,
    });
  const canVoteAction =
    canAct &&
    canVoteTarget({
      time,
      actorAlive: isCurrentUserAlive,
      targetAlive: player.isAlive !== false,
      isSelf: player.name === playerName,
      canVote,
      nightVote: visitCapability.nightVote,
    }) &&
    (isDayTime || visitCapability.nightVote);
  const canWhisperAction =
    whispersEnabled &&
    canAct &&
    canWhisperTarget({
      time,
      targetAlive: player.isAlive !== false,
      isSelf: player.name === playerName,
      hasMessage: !!messageDraft.trim(),
    });
  const status = [
    player.isAlive === false
      ? "Eliminated"
      : player.connected === false
        ? "Disconnected"
        : recentSpeaker
          ? "Last spoke"
          : undefined,
    !ended && player.voteStatus
      ? player.voteStatus === "pending"
        ? "Not voted"
        : player.voteStatus === "abstained"
          ? "Abstained"
          : `Voted${player.voteTarget ? ` for ${player.voteTarget}` : ""}`
      : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      aria-label={`${player.name} is ${player.isAlive === false ? "dead" : "alive"}`}
      data-testid="player-row"
      data-player-index={index}
      data-selected={selected}
      data-highlighted={highlighted}
      className={`border-border flex items-center gap-2 border-b px-2 py-3 text-sm ${
        highlighted ? "bg-accent" : player.isAlive === false
          ? "text-muted-foreground bg-destructive/5"
          : selected
            ? "bg-primary/10"
            : ""
      }`}
    >
      <PlayerAvatar name={player.name} preset={player.avatarPreset} anonymous={started} />
      <span className="min-w-0 flex-1 truncate">
        {player.name}
        {player.name === playerName ? " (You)" : ""}
        {status ? (
          <span className="text-muted-foreground block text-xs">{status}</span>
        ) : null}
        {!ended && player.votesReceived !== undefined ? (
          <span
            className={`block text-xs ${leader ? "text-primary font-semibold" : "text-muted-foreground"}`}
          >
            {player.votesReceived} vote{player.votesReceived === 1 ? "" : "s"}
            {votesRequired ? ` / ${votesRequired} needed` : ""}
            {leader ? " · Leading" : ""}
          </span>
        ) : null}
        {player.role || player.faction ? (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            {player.role ? <RoleIcon role={player.role} size={14} /> : null}
            {player.role ?? player.faction}
          </span>
        ) : null}
      </span>
      <div className="flex items-center gap-1">
        {onNotes && started ? <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`${hasNote ? "Edit" : "Add"} private note for ${player.name}`} title={hasNote ? "Edit private note" : "Add private note"} onClick={() => onNotes(player.name)}><NotebookPen className="h-4 w-4" aria-hidden />{hasNote ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}</Button> : null}
        {showVisit ? (
          <Button
            onClick={() => onVisit(index)}
            disabled={!canVisit}
            size="sm"
            title={roleVisitLabel(currentUserRole, time)}
            aria-label={`${roleVisitLabel(currentUserRole, time)} ${player.name}`}
            aria-pressed={!ended && action.visit === player.name}
            className="h-11 gap-1.5 px-2"
          >
            <ActionIcon action={visitActionIcon(currentUserRole, time)} size={14} />
            {roleVisitLabel(currentUserRole, time)}
          </Button>
        ) : null}
        {isDayTime || visitCapability.nightVote ? (
          <Button
            onClick={() => onVote(index)}
            disabled={!canVoteAction}
            variant="secondary"
            size="icon"
            title="Vote"
            aria-label={`Vote for ${player.name}`}
            aria-pressed={!ended && action.vote === player.name}
            className="h-11 w-11"
          >
            <ActionIcon action="vote" size={14} />
          </Button>
        ) : null}
        {isDayTime ? (
          <Button
            onClick={() => onWhisper(index)}
            disabled={!canWhisperAction}
            variant="outline"
            size="icon"
            title="Whisper using draft"
            aria-label={`Whisper to ${player.name}`}
            className="h-11 w-11"
          >
            <ActionIcon action="whisper" size={14} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
