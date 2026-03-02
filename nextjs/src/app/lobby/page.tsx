"use client";

import { useGameLobby } from "./hooks/useGameLobby";
import { Header } from "~/components/header";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { CheckCircle2, Eye, MessageSquare } from "lucide-react";
import type { VisitCapability, DayTime } from "@mernmafia/shared/game/playerActionRules";
import {
  canVoteTarget,
  canWhisperTarget,
  canPerformVisit,
  shouldShowDayOnlyActions,
  shouldShowVisitAction,
} from "@mernmafia/shared/game/playerActionRules";
import type { Player } from "./hooks/useGameLobby";

type PlayerRowProps = {
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

function PlayerRow({
  player, index, playerName, time, isCurrentUserAlive,
  currentUserRole, visitCapability, canVote, messageDraft,
  onVote, onVisit, onWhisper,
}: PlayerRowProps) {
  const isDayTime = shouldShowDayOnlyActions(time);
  const showVisit = shouldShowVisitAction(time, visitCapability);
  const canVisit = canPerformVisit({
    time, isSelf: player.name === playerName, targetAlive: player.isAlive !== false,
    actorAlive: isCurrentUserAlive, actorRole: currentUserRole,
    targetRole: player.role, capability: visitCapability,
  });
  const canVoteAction =
    canVoteTarget({
      time, actorAlive: isCurrentUserAlive,
      targetAlive: player.isAlive !== false, isSelf: player.name === playerName, canVote,
    }) && isDayTime;
  const canWhisperAction = canWhisperTarget({
    time, targetAlive: player.isAlive !== false,
    isSelf: player.name === playerName, hasMessage: !!messageDraft.trim(),
  });

  return (
    <div
      aria-label={`${player.name} is ${player.isAlive === false ? "dead" : "alive"}`}
      className={`flex items-center gap-2 rounded-md border border-border p-1.5 text-sm ${
        player.isAlive === false ? "bg-destructive/20" : "bg-secondary/40"
      }`}
    >
      <span className="min-w-0 flex-1 truncate">
        {player.name}
        {player.name === playerName ? " (You)" : ""}
      </span>
      <div className="flex items-center gap-1">
        {showVisit ? (
          <Button
            onClick={() => onVisit(index)}
            disabled={!canVisit}
            size="icon" title="Visit" aria-label="Visit player"
            className="h-7 w-7"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {isDayTime ? (
          <Button
            onClick={() => onVote(index)}
            disabled={!canVoteAction}
            variant="secondary" size="icon" title="Vote" aria-label="Vote player"
            className="h-7 w-7"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {isDayTime ? (
          <Button
            onClick={() => onWhisper(index)}
            disabled={!canWhisperAction}
            variant="outline" size="icon" title="Whisper using draft"
            aria-label="Whisper to player" className="h-7 w-7"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function LobbyPage() {
  const {
    joinStatus, playerName, joining, players, messages,
    messageDraft, time, dayNumber, timeLeft, canTalk, canVote,
    visitCapability, currentUserRole,
    joinGame, sendMessage, voteForPlayer, visitPlayer, whisperToPlayer, setMessageDraft,
  } = useGameLobby();

  const isCurrentUserAlive =
    players.find((p) => p.name === playerName)?.isAlive !== false;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto h-[calc(100vh-3.5rem)] w-full max-w-7xl px-4 py-3">
        {!playerName ? (
          <Card className="mx-auto mt-16 max-w-2xl">
            <CardContent className="space-y-3 p-6 text-center">
              <CardTitle className="text-2xl">Connecting to Game Lobby</CardTitle>
              <p className="text-sm text-muted-foreground">
                {joinStatus || "Attempting to join a room now..."}
              </p>
              <Button onClick={joinGame} disabled={joining} className="mx-auto" size="sm">
                {joining ? "Connecting..." : "Retry Connection"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid h-full gap-3 lg:grid-cols-[2fr_1fr]">
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-2 p-3">
                <div className="themed-scrollbar flex-1 space-y-1 overflow-y-auto rounded-md border p-2">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No messages yet.</p>
                  ) : (
                    messages.map((msg) => (
                      <p key={msg.id} className="text-sm">{msg.text}</p>
                    ))
                  )}
                </div>
                <div className="flex gap-1">
                  <Input
                    placeholder={canTalk ? "Send a message..." : "You cannot talk right now"}
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    disabled={!canTalk}
                  />
                  <Button onClick={sendMessage} disabled={!canTalk || !messageDraft.trim()}>
                    Send
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader className="space-y-2 px-3 pb-1 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{time}</Badge>
                  <Badge variant="outline">Day {dayNumber}</Badge>
                  <Badge variant="outline">Time Left: {timeLeft}s</Badge>
                </div>
                <p className="text-sm text-muted-foreground" aria-label="Assigned player name">
                  You joined as <strong>{playerName}</strong>
                </p>
              </CardHeader>
              <CardContent className="h-[calc(100%-4.75rem)] px-3 pb-3 pt-1">
                <div className="themed-scrollbar h-full space-y-1 overflow-y-auto rounded-md border p-1.5">
                  {players.map((player, index) => (
                    <PlayerRow
                      key={player.name}
                      player={player}
                      index={index}
                      playerName={playerName}
                      time={time}
                      isCurrentUserAlive={isCurrentUserAlive}
                      currentUserRole={currentUserRole}
                      visitCapability={visitCapability}
                      canVote={canVote}
                      messageDraft={messageDraft}
                      onVote={voteForPlayer}
                      onVisit={visitPlayer}
                      onWhisper={whisperToPlayer}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
