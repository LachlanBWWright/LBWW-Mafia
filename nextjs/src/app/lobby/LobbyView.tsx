"use client";
import { useState } from "react";
import type { LobbyState } from "@mernmafia/shared/game/lobbyState";
import type { LobbyActions } from "@mernmafia/shared/game/useGameLobby";
import {
  resolveLobbyTab,
  type LobbyTabSelection,
} from "@mernmafia/shared/game/lobbyPresentation";
import { ObserverNotice } from "./ObserverNotice";
import { PrivateNotesPanel } from "./PrivateNotesPanel";
import { LobbyGroupPanel } from "~/components/lobby-group";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { PlayerRow } from "./PlayerRow";
import { AiCharactersPanel } from "./AiCharactersPanel";
import {
  ActionPanel,
  ChatLog,
  MatchRecapPanel,
  RoleReference,
  PhaseHeader,
} from "./MatchPanels";
import { DayTime } from "@mernmafia/shared/communication/events";
import {
  canConfigureAiCharacters,
  phaseActionHint,
  voteSummary,
} from "@mernmafia/shared/game/matchExperience";
import "./match.css";

export type LobbyViewProps = {
  lobby: LobbyState & LobbyActions;
  roomId: string;
  practice: boolean;
  onPracticeChange: (practice: boolean) => void;
  onSpectate: () => void;
  noteOwnerId?: string;
  spectating?: boolean;
};

export function LobbyView({
  lobby,
  roomId,
  practice,
  onPracticeChange,
  onSpectate,
  noteOwnerId,
  spectating = false,
}: LobbyViewProps) {
  const observer =
    lobby.participation === "spectator" || lobby.participation === "eliminated";
  const alive =
    lobby.players.find((player) => player.name === lobby.playerName)
      ?.isAlive !== false;
  const votes = voteSummary(lobby.players, lobby.voteVisibility);
  const actionHint = phaseActionHint({
    time: lobby.time,
    capability: lobby.visitCapability,
    started: lobby.started,
    ended: lobby.ended,
    canVote: lobby.canVote,
    actorAlive: alive,
  });
  const tabContext = {
    scope: `${roomId}:${practice}:${lobby.participation}:${lobby.matchId}`,
    ended: !!lobby.ended,
    groupAvailable: false,
  };
  const [tabSelection, setTabSelection] = useState<LobbyTabSelection>();
  const [muted, setMuted] = useState(false);
  const tab = resolveLobbyTab(tabSelection, tabContext);
  const setTab = (nextTab: "chat" | "players") =>
    setTabSelection({ ...tabContext, tab: nextTab });
  if (!lobby.playerName)
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">
          {lobby.joining
            ? "Connecting to your lobby"
            : "Connection unavailable"}
        </h1>
        <p role="status" className="text-muted-foreground my-4 text-sm">
          {lobby.joinStatus.length ? lobby.joinStatus : "Reserving your seat…"}
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={lobby.joinGame} disabled={lobby.joining}>
            {lobby.joining ? "Connecting…" : "Retry connection"}
          </Button>
          <Button variant="outline" onClick={onSpectate} disabled={spectating}>
            Watch game
          </Button>
          <Button variant="outline" onClick={() => onPracticeChange(true)}>
            Practice match
          </Button>
        </div>
      </main>
    );
  return (
    <main className="bg-background flex h-[calc(100dvh-3.5rem-1px)] w-full min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 px-4 sm:px-6">
        <PhaseHeader lobby={lobby} practice={practice} />
      </div>
      <div className="flex shrink-0 gap-2 border-b px-4 py-2 lg:hidden">
        <Button
          size="sm"
          variant={tab === "chat" ? "default" : "outline"}
          className="flex-1"
          aria-pressed={tab === "chat"}
          onClick={() => setTab("chat")}
        >
          Chat
        </Button>
        <Button
          size="sm"
          variant={tab === "players" ? "default" : "outline"}
          className="flex-1"
          aria-pressed={tab === "players"}
          onClick={() => setTab("players")}
        >
          Players
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section
          aria-label="Room chat"
          className={`${tab !== "chat" ? "hidden lg:flex" : "flex"} min-h-0 min-w-0 flex-col`}
        >
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2 sm:px-6">
            <h2 className="text-sm font-semibold">
              {observer ? "Spectator chat" : "Room chat"}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={muted}
                onClick={() => setMuted(!muted)}
              >
                {muted ? "Unmute bots" : "Mute bots"}
              </Button>
              {!lobby.started || practice ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onPracticeChange(!practice)}
                >
                  {practice ? "Return to lobby" : "Practice match"}
                </Button>
              ) : null}
            </div>
          </header>
          <ObserverNotice lobby={lobby} />
          {!lobby.connected ? (
            <p
              role="alert"
              className="border-destructive/40 bg-destructive/10 my-2 rounded-md border px-3 py-2 text-sm"
            >
              Reconnecting… Your seat is reserved briefly. Actions are paused.
            </p>
          ) : null}
          {lobby.recoveryNotice ? (
            <div
              role="status"
              className="flex items-center justify-between gap-3 border-b py-2 text-sm"
            >
              <p>{lobby.recoveryNotice}</p>
              <Button size="sm" variant="ghost" onClick={lobby.dismissRecovery}>
                Dismiss
              </Button>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-6">
            <ChatLog messages={lobby.messages} muted={muted} />
          </div>
          <div className="flex shrink-0 gap-3 border-t px-4 py-4 sm:px-6">
            <Input
              className="h-11 min-w-0 flex-1"
              aria-label="Message"
              maxLength={150}
              placeholder={
                lobby.canTalk
                  ? observer
                    ? "Message spectators…"
                    : "Message the room…"
                  : "Chat unavailable this phase"
              }
              value={lobby.messageDraft}
              onChange={(e) => lobby.setMessageDraft(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing)
                  lobby.sendMessage();
              }}
              disabled={!lobby.canTalk || !lobby.connected}
            />
            <Button
              className="h-11 px-5"
              onClick={lobby.sendMessage}
              disabled={
                !lobby.connected || !lobby.canTalk || !lobby.messageDraft.trim()
              }
            >
              Send
            </Button>
          </div>
        </section>
        <aside
          aria-label="Players and game controls"
          className={`${tab !== "players" ? "hidden lg:flex" : "flex"} bg-card/40 min-h-0 min-w-0 flex-col lg:border-s`}
        >
          <div className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
            <div>
              <h2 className="font-semibold">
                Players ({lobby.players.length})
              </h2>
            </div>
            {canConfigureAiCharacters(lobby, practice) ? (
              <AiCharactersPanel roomId={roomId} />
            ) : null}
          </div>
          {!observer && lobby.started ? (
            <div className="shrink-0 px-4">
              <ActionPanel
                lobby={lobby}
                cancel={lobby.cancelVisit}
                abstain={() => lobby.voteForPlayer(null)}
                practice={practice}
                advancePractice={lobby.advancePractice}
              />
            </div>
          ) : null}
          <div className="themed-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <MatchRecapPanel lobby={lobby} onReady={lobby.readyForRematch} />
            {lobby.time === DayTime.Day && lobby.started && !lobby.ended ? (
              <p className="text-muted-foreground py-3 text-xs">
                {votes
                  ? `${votes.required} votes to eliminate`
                  : "Votes hidden"}
              </p>
            ) : null}
            <div>
              {lobby.players.map((player, index) => (
                <PlayerRow
                  key={player.name}
                  player={player}
                  index={index}
                  playerName={lobby.playerName}
                  time={lobby.time}
                  isCurrentUserAlive={alive}
                  currentUserRole={lobby.currentUserRole}
                  visitCapability={lobby.visitCapability}
                  canVote={
                    lobby.connected &&
                    !!lobby.started &&
                    !lobby.ended &&
                    lobby.canVote &&
                    lobby.action.vote === undefined
                  }
                  canAct={
                    lobby.connected &&
                    !!lobby.started &&
                    !lobby.ended &&
                    !observer
                  }
                  action={lobby.action}
                  ended={lobby.ended}
                  leader={
                    lobby.time === DayTime.Day &&
                    !lobby.ended &&
                    !!votes?.leaders.includes(player.name)
                  }
                  recentSpeaker={lobby.messages.at(-1)?.sender === player.name}
                  messageDraft={lobby.messageDraft}
                  onVote={lobby.voteForPlayer}
                  onVisit={lobby.visitPlayer}
                  onWhisper={lobby.whisperToPlayer}
                />
              ))}
            </div>

            <RoleReference
              name={lobby.currentUserRole}
              capability={lobby.visitCapability}
            />

            <details className="border-b py-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Private notes
              </summary>
              <div className="pt-3">
                <PrivateNotesPanel lobby={lobby} ownerId={noteOwnerId} />
              </div>
            </details>
            {!practice && noteOwnerId ? (
              <details className="border-b py-2">
                <summary className="cursor-pointer text-sm font-medium">
                  Group and invitations
                </summary>
                <LobbyGroupPanel
                  roomId={roomId}
                  onFollowRoom={(nextRoom) => {
                    const url = new URL("/lobby", window.location.origin);
                    url.searchParams.set("room", nextRoom);
                    if (spectating) url.searchParams.set("spectate", "1");
                    window.location.assign(url.toString());
                  }}
                />
              </details>
            ) : null}
          </div>
        </aside>
      </div>
      <div className="flex items-center justify-between gap-3 border-t px-4 py-2 text-sm lg:hidden">
        <p role="status" className="min-w-0">
          {observer
            ? "Spectator chat"
            : lobby.ended
              ? actionHint
              : (lobby.action.feedback ?? actionHint)}
        </p>
        {tab === "chat" && lobby.started && !lobby.ended && !observer ? (
          <Button size="sm" variant="outline" onClick={() => setTab("players")}>
            Your action
          </Button>
        ) : null}
      </div>
    </main>
  );
}
