"use client";
import { memo, useEffect, useRef } from "react";
import { Moon, Sun } from "lucide-react";
import { DayTime } from "@mernmafia/shared/communication/events";
import {
  formatClock,
  roleReference,
  visibleMessages,
  phaseActionHint,
  roleActionRestrictions,
  type LobbyMessage,
} from "@mernmafia/shared/game/matchExperience";
import {
  chatMessagePresentation,
  lobbyPhaseLabel,
} from "@mernmafia/shared/game/lobbyPresentation";
import type { LobbyState } from "@mernmafia/shared/game/lobbyState";
import { Button } from "~/components/ui/button";
import type { VisitCapability } from "@mernmafia/shared/game/playerActionRules";

export function PhaseHeader({
  lobby,
  practice = false,
}: {
  lobby: LobbyState;
  practice?: boolean;
}) {
  const night = lobby.time === DayTime.Night;
  const Icon = night ? Moon : Sun;
  return (
    <header
      className={`phase-header flex items-center justify-between gap-4 border-b px-1 py-4 ${night ? "border-indigo-400/30" : "border-amber-400/30"}`}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={night ? "text-indigo-400" : "text-amber-500"}
          aria-hidden
        />
        <div>
          <h1 className="phase-heading text-2xl font-semibold tracking-tight">
            {lobbyPhaseLabel(lobby)}
          </h1>
          <p
            aria-label="Your player name"
            className="text-muted-foreground text-sm"
          >
            {lobby.playerName}
            {lobby.currentUserRole ? ` · ${lobby.currentUserRole}` : ""}
            {practice ? " · Practice" : ""}
          </p>
        </div>
      </div>
      {lobby.started && !lobby.ended && !practice ? (
        <span
          role="timer"
          aria-label={`${lobby.timeLeft} seconds remaining`}
          className={`text-3xl font-semibold tabular-nums ${lobby.timeLeft <= 10 ? "text-destructive" : ""}`}
        >
          {formatClock(lobby.timeLeft)}
        </span>
      ) : null}
    </header>
  );
}
export function ActionPanel({
  lobby,
  cancel,
  abstain,
  advancePractice,
  practice,
}: {
  lobby: LobbyState;
  cancel: () => void;
  abstain: () => void;
  advancePractice?: () => void;
  practice?: boolean;
}) {
  const hasVisit = Boolean(lobby.action.visit);
  const hint = phaseActionHint({
    time: lobby.time,
    capability: lobby.visitCapability,
    started: lobby.started,
    ended: lobby.ended,
    canVote: lobby.canVote,
    actorAlive:
      lobby.players.find((player) => player.name === lobby.playerName)
        ?.isAlive !== false,
  });
  return (
    <section
      aria-label="Your action"
      className="border-border space-y-2 border-b py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Your action</h2>
        {hasVisit && !lobby.ended && lobby.action.outcome === "submitted" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={cancel}
            disabled={!lobby.connected}
          >
            Cancel action
          </Button>
        ) : null}
      </div>
      <p
        role="status"
        className={`text-sm ${!lobby.ended && (lobby.action.outcome === "blocked" || lobby.action.outcome === "rejected") ? "text-destructive" : "text-muted-foreground"}`}
      >
        {lobby.ended ? hint : (lobby.action.feedback ?? hint)}
      </p>
      {!lobby.ended && lobby.action.vote !== undefined ? (
        <p className="text-sm">
          {lobby.action.vote === null
            ? "Abstained"
            : `Your vote: ${lobby.action.vote}`}
        </p>
      ) : lobby.started &&
        !lobby.ended &&
        lobby.time === DayTime.Day &&
        lobby.canVote ? (
        <Button
          size="sm"
          variant="outline"
          onClick={abstain}
          disabled={!lobby.connected}
        >
          Abstain
        </Button>
      ) : null}
      {practice && !lobby.ended ? (
        <p className="text-sm">
          {lobby.time === DayTime.Night
            ? "Protect Mira, then continue to the day discussion."
            : "Read Mira's clue, then vote for the player you suspect."}
        </p>
      ) : null}
      {practice && hasVisit && lobby.time === DayTime.Night ? (
        <Button size="sm" onClick={advancePractice}>
          Continue to day
        </Button>
      ) : null}
    </section>
  );
}
export function RoleReference({
  name,
  capability,
}: {
  name?: string;
  capability?: VisitCapability;
}) {
  const role = roleReference(name);
  if (!role) return null;
  return (
    <details className="border-border border-b py-3">
      <summary className="cursor-pointer text-sm font-semibold">
        Your role: {role.name}
      </summary>
      <div className="mt-2 space-y-2 text-sm">
        <p>{role.objective}</p>
        <p className="text-muted-foreground">{role.description}</p>
        {capability
          ? roleActionRestrictions(capability).map((restriction) => (
              <p key={restriction} className="text-muted-foreground">
                {restriction}
              </p>
            ))
          : null}
      </div>
    </details>
  );
}
export function MatchRecapPanel({
  lobby,
  onReady,
}: {
  lobby: LobbyState;
  onReady: () => void;
}) {
  if (!lobby.recap) return null;
  const ready = lobby.readyPlayers?.includes(lobby.playerName) ?? false;
  return (
    <section className="space-y-4 border-b py-4" aria-label="Match recap">
      <div>
        <h2 className="text-xl font-semibold">
          {lobby.recap.winner === "draw"
            ? "A draw"
            : `${lobby.recap.winner} wins`}
        </h2>
        <p className="text-muted-foreground text-sm">{lobby.recap.reason}</p>
      </div>
      <ul className="space-y-1">
        {lobby.recap.players.map((player) => (
          <li key={player.name} className="flex justify-between gap-3 text-sm">
            <span>
              {player.name}
              {player.won ? " · Winner" : ""}
            </span>
            <span className="text-muted-foreground">{player.role}</span>
          </li>
        ))}
      </ul>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Match timeline
        </summary>
        <ol className="mt-2 space-y-2 text-sm">
          {lobby.recap.timeline.map((entry) => (
            <li key={entry.id}>
              <span className="text-muted-foreground">
                {entry.phase} {entry.day} ·{" "}
              </span>
              {entry.text}
            </li>
          ))}
        </ol>
      </details>
      <div className="flex items-center gap-3">
        <Button
          onClick={onReady}
          disabled={
            ready || !lobby.connected || lobby.participation === "spectator"
          }
        >
          {ready ? "Ready for next match" : "Play again"}
        </Button>
        <span className="text-muted-foreground text-sm">
          {lobby.readyPlayers?.length ?? 0}/
          {lobby.capacity ?? lobby.players.length} ready
        </span>
      </div>
      {lobby.players.length < (lobby.capacity ?? lobby.players.length) ? (
        <p className="text-muted-foreground text-sm">
          Waiting for replacement players to fill the room.
        </p>
      ) : null}
    </section>
  );
}
export const ChatLog = memo(function ChatLog({
  messages,
  muted,
}: {
  messages: LobbyMessage[];
  muted: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const filtered = visibleMessages(messages, muted);
  useEffect(() => {
    if (nearBottom.current && ref.current)
      ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages, muted]);
  return (
    <div
      ref={ref}
      onScroll={() => {
        const el = ref.current;
        if (el)
          nearBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      role="log"
      aria-label="Game chat"
      aria-relevant="additions"
      aria-live="polite"
      className="themed-scrollbar min-h-0 flex-1 overflow-y-auto py-3"
    >
      {!filtered.length ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {muted && messages.length
            ? "Bot chatter is muted."
            : "The conversation starts here."}
        </p>
      ) : (
        filtered.map((message, index) => {
          const { grouped, text } = chatMessagePresentation(
            message,
            filtered[index - 1],
          );
          return (
            <div
              key={message.id}
              className={`${grouped ? "pt-1" : "mt-3 pt-2"} ${message.kind === "system" ? "border-border text-muted-foreground border-t text-xs" : message.kind === "whisper" ? "border-primary/40 text-primary border-l-2 pl-3 text-sm" : message.kind === "role" || message.kind === "spectator" ? "text-primary text-sm" : "text-sm"}`}
            >
              {message.kind === "chat" && message.sender ? (
                <>
                  {!grouped ? (
                    <p className="mb-1 font-semibold">
                      {message.sender}
                      {message.isBot ? (
                        <span className="text-muted-foreground ml-2 text-xs font-normal">
                          Bot
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  <p className="leading-6 break-words">{text}</p>
                </>
              ) : (
                <p className="leading-5 break-words">{message.text}</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
});
