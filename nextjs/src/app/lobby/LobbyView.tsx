"use client";
import { useRef, useState } from "react";
import { createLobbyLink } from "@mernmafia/shared/game/lobbyLinks";
import { gameThemeColors } from "@mernmafia/shared/game/gameSetupPresentation";
import { GameSetupSummary } from "./GameSetupSummary";
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
import { ChatComposer } from "./ChatComposer";
import { PlayerRow } from "./PlayerRow";
import { LobbyDetails } from "./LobbyDetails";
import { LobbyInvites } from "./LobbyInvites";
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
  matchActionLabel,
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
  reducedMotion?: boolean;
};

export function LobbyView({
  lobby,
  roomId,
  practice,
  onPracticeChange,
  onSpectate,
  noteOwnerId,
  spectating = false,
  reducedMotion = false,
}: LobbyViewProps) {
  const observer =
    lobby.participation === "spectator" || lobby.participation === "eliminated";
  const alive =
    lobby.players.find((player) => player.name === lobby.playerName)
      ?.isAlive !== false;
  const votes = voteSummary(lobby.players, lobby.voteVisibility, lobby.setup?.rules.voting.method);
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
  const [shareStatus, setShareStatus] = useState("");
  const [highlighted, setHighlighted] = useState<string>();
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleReturnToChat, setRoleReturnToChat] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<string>();
  const [noteNames, setNoteNames] = useState<string[]>([]);
  const playersRef = useRef<HTMLElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDetailsElement>(null);
  const [tabSelection, setTabSelection] = useState<LobbyTabSelection>();
  const tab = resolveLobbyTab(tabSelection, tabContext);
  const setTab = (nextTab: "chat" | "players") =>
    setTabSelection({ ...tabContext, tab: nextTab });
  const showPlayer = (name: string) => {
    const index = lobby.players.findIndex((player) => player.name === name);
    if (index < 0) return;
    setHighlighted(name);
    setTab("players");
    requestAnimationFrame(() => playersRef.current?.querySelector(`[data-player-index="${index}"]`)?.scrollIntoView({ block: "nearest" }));
  };
  const showNotes = (name: string) => {
    setNoteTarget(name);
    setNotesOpen(true);
    setTab("players");
    requestAnimationFrame(() => notesRef.current?.scrollIntoView({ block: "nearest" }));
  };
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
    <main
      data-game-theme={lobby.setup?.rules.presentation.theme}
      data-reduced-motion={reducedMotion ? "true" : undefined}
      style={{
        backgroundColor: gameThemeColors(lobby.setup?.rules.presentation.theme)
          ?.background,
      }}
      className="bg-background text-foreground flex h-[calc(100dvh-3.5rem-1px)] w-full min-w-0 flex-col overflow-hidden"
    >
      <div className="shrink-0 px-4 sm:px-6">
        <PhaseHeader lobby={lobby} practice={practice} onRolePress={() => { setRoleReturnToChat(tab === "chat"); setRoleOpen(true); setTab("players"); requestAnimationFrame(() => roleRef.current?.scrollIntoView({ block: "nearest" })); }} />
        <GameSetupSummary setup={lobby.setup} started={lobby.started} />
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
          {!lobby.started || practice ? (
            <div className="flex justify-end px-4 pt-2 sm:px-6">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onPracticeChange(!practice)}
              >
                {practice ? "Return to lobby" : "Practice match"}
              </Button>
            </div>
          ) : null}
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
              <Button size="sm" variant="ghost" onClick={() => { setTab("chat"); requestAnimationFrame(() => { const log = document.querySelector('[role="log"][aria-label="Game chat"]'); if (log) log.scrollTop = log.scrollHeight; }); }}>View recent messages</Button>
              <Button size="sm" variant="ghost" onClick={lobby.dismissRecovery}>
                Dismiss
              </Button>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-6">
            <ChatLog
              key={`${lobby.matchId}:${!!lobby.started}`}
              messages={lobby.messages}
              playerNames={lobby.players.map((player) => player.name)}
              onPlayerSelect={showPlayer}
              anonymous={!!lobby.started}
              muted={false}
              compact={
                lobby.setup?.rules.presentation.announcementStyle === "concise"
              }
            />
          </div>
          <ChatComposer value={lobby.messageDraft} onChange={lobby.setMessageDraft} onSend={lobby.sendMessage} players={lobby.players} ownRole={lobby.currentUserRole} disabled={!lobby.canTalk || !lobby.connected} placeholder={lobby.canTalk ? observer ? "Message spectators…" : "Message the room…" : "Chat unavailable this phase"} />
        </section>
        <aside
          ref={playersRef}
          aria-label="Players and game controls"
          className={`${tab !== "players" ? "hidden lg:flex" : "flex"} bg-card/40 min-h-0 min-w-0 flex-col lg:border-s`}
        >
          <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
            <div>
              <h2 className="font-semibold">
                Players ({lobby.players.length}
                {!lobby.started && lobby.capacity != null
                  ? `/${lobby.capacity}`
                  : ""}
                )
              </h2>
            </div>
            {!practice && !lobby.started ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(createLobbyLink(window.location.origin, roomId))
                    .then(() => setShareStatus("Lobby link copied."))
                    .catch(() => setShareStatus("Unable to copy lobby link."));
                }}
              >
                Share lobby
              </Button>
            ) : null}
            {canConfigureAiCharacters(lobby, practice) ? (
              <AiCharactersPanel roomId={roomId} />
            ) : null}
          </div>
          {!practice && !lobby.started ? (
            <LobbyDetails roomId={roomId} />
          ) : null}
          {!practice && !lobby.started && noteOwnerId ? (
            <LobbyInvites roomId={roomId} />
          ) : null}
          {shareStatus ? (
            <p role="status" className="px-4 py-1 text-sm">
              {shareStatus}
            </p>
          ) : null}
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
          <div className="[scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <MatchRecapPanel lobby={lobby} onReady={lobby.readyForRematch} />
            {lobby.time === DayTime.Day && lobby.started && !lobby.ended ? (
              <p className="text-muted-foreground py-3 text-xs">
                {votes
                  ? votes.required ? `${votes.required} votes to eliminate` : "Plurality vote"
                  : "Votes hidden"}
              </p>
            ) : null}
            <div>
              {lobby.players.map((player, index) => (
                <PlayerRow
                  started={lobby.started}
                  highlighted={highlighted === player.name}
                  hasNote={noteNames.includes(player.name)}
                  onNotes={showNotes}
                  votesRequired={votes?.required}
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
                    (lobby.action.vote === undefined ||
                      (lobby.time === DayTime.Day &&
                        !!lobby.setup?.rules.voting.allowRevote))
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
                  whispersEnabled={lobby.setup?.rules.communication.whispers}
                  onVote={lobby.voteForPlayer}
                  onVisit={lobby.visitPlayer}
                  onWhisper={lobby.whisperToPlayer}
                />
              ))}
            </div>

            <div ref={roleRef}><RoleReference
              name={lobby.currentUserRole}
              capability={lobby.visitCapability}
              customRoles={lobby.setup?.customRoles}
              open={roleOpen}
              onToggle={setRoleOpen}
            />{roleOpen && roleReturnToChat ? <Button className="lg:hidden" variant="ghost" size="sm" onClick={() => { setRoleOpen(false); setRoleReturnToChat(false); setTab("chat"); }}>Back to chat</Button> : null}</div>

            <details ref={notesRef} open={notesOpen} onToggle={(event) => setNotesOpen(event.currentTarget.open)} className="border-b py-3">
              <summary className="cursor-pointer text-sm font-semibold">
                Private notes
              </summary>
              <div className="pt-3">
                {noteTarget ? <Button size="sm" variant="ghost" onClick={() => setNoteTarget(undefined)}>Show all players</Button> : null}
                <PrivateNotesPanel lobby={lobby} ownerId={noteOwnerId} focusPlayer={noteTarget} onBoardChange={setNoteNames} />
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2 text-sm lg:hidden">
        <p role="status" className="min-w-0">
          {observer
            ? "Spectator chat"
            : lobby.ended
              ? actionHint
              : (lobby.action.feedback ?? actionHint)}
        </p>
        {tab === "chat" && lobby.started && !lobby.ended && !observer ? (
          <Button size="sm" variant="outline" onClick={() => { const target = lobby.action.visit ?? lobby.action.vote; if (target) showPlayer(target); else setTab("players"); }}>
            {matchActionLabel(lobby)}
          </Button>
        ) : null}
      </div>
    </main>
  );
}
