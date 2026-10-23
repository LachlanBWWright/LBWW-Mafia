"use client";

import { roleVisitLabel } from "@mernmafia/shared/game/lobbyPresentation";
import type { ActionSelection } from "@mernmafia/shared/game/matchExperience";
import { Button } from "~/components/ui/button";
import { CheckCircle2, Eye, MessageSquare } from "lucide-react";
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

type PlayerRowProps = {
  ended?: boolean;
  action?: ActionSelection;
  canAct?: boolean;
  leader?: boolean;
  recentSpeaker?: boolean;
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
  ended = false,
  action = {},
  canAct = true,
  leader = false,
  recentSpeaker = false,
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
      className={`border-border flex items-center gap-2 border-b px-2 py-3 text-sm ${
        player.isAlive === false
          ? "text-muted-foreground bg-destructive/5"
          : selected
            ? "bg-primary/10"
            : ""
      }`}
    >
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
            {leader ? " · Leading" : ""}
          </span>
        ) : null}
        {player.role ? (
          <span className="text-muted-foreground block text-xs">
            {player.role}
          </span>
        ) : null}
      </span>
      <div className="flex items-center gap-1">
        {showVisit ? (
          <Button
            onClick={() => onVisit(index)}
            disabled={!canVisit}
            size="sm"
            title={roleVisitLabel(currentUserRole, time)}
            aria-label={`Visit ${player.name}`}
            aria-pressed={!ended && action.visit === player.name}
            className="h-11 gap-1.5 px-2"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
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
            <CheckCircle2 className="h-3.5 w-3.5" />
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
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
