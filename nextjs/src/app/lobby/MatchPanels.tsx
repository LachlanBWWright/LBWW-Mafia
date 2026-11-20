"use client";
import { memo, useEffect, useRef, useState } from "react";
import { Moon, Sun, Skull, Sparkles, Trophy } from "lucide-react";
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
  chatEventStyle,
  lobbyPhaseLabel,
} from "@mernmafia/shared/game/lobbyPresentation";
import type { LobbyState } from "@mernmafia/shared/game/lobbyState";
import { Button } from "~/components/ui/button";
import { canAbstain, type VisitCapability } from "@mernmafia/shared/game/playerActionRules";
import { RoleIcon } from "~/components/role-icon";
import { PlayerAvatar } from "~/components/player-avatar";
import { ActionIcon } from "~/components/action-icon";

export function PhaseHeader({
  lobby,
  practice = false,
  onRolePress,
}: {
  lobby: LobbyState;
  practice?: boolean;
  onRolePress?: () => void;
}) {
  const night = lobby.time === DayTime.Night;
  const Icon = night ? Moon : Sun;
  const phase = lobby.started && !lobby.ended ? `${lobby.matchId ?? ""}:${lobby.time}:${lobby.dayNumber}` : "";
  const previousPhase = useRef(phase);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const previous = previousPhase.current;
    previousPhase.current = phase;
    if (!phase) { const clear = setTimeout(() => setAnnouncement(""), 0); return () => clearTimeout(clear); }
    if (!previous || previous === phase) return;
    const show = setTimeout(() => setAnnouncement(`${lobby.time} ${lobby.dayNumber} begins`), 0);
    const hide = setTimeout(() => setAnnouncement(""), 2400);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [phase, lobby.time, lobby.dayNumber]);
  return (
    <>
    <header
      className={`phase-header relative flex items-center justify-between gap-4 border-b border-l-2 px-3 py-2 ${night ? "border-indigo-400/50 bg-indigo-400/5" : "border-amber-400/50 bg-amber-400/5"}`}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={night ? "text-indigo-400" : "text-amber-500"}
          aria-hidden
        />
        <div>
          <h1 aria-live="polite" className="phase-heading text-xl font-semibold tracking-tight">
            {lobbyPhaseLabel(lobby)}
          </h1>
          <p
            aria-label="Your player name"
            className="text-muted-foreground flex items-center gap-1 text-sm"
          >
            {lobby.playerName}
            {lobby.currentUserRole ? <><span aria-hidden>·</span><RoleIcon role={lobby.currentUserRole} size={14} />{onRolePress ? <button type="button" className="hover:underline focus-visible:outline focus-visible:outline-2" onClick={onRolePress}>{lobby.currentUserRole}</button> : lobby.currentUserRole}</> : null}
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
    {announcement ? <div data-testid="phase-announcement" aria-hidden className="border-border bg-muted/40 border-b px-3 py-1 text-sm font-semibold">{announcement}</div> : null}
    </>
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
            <ActionIcon action="cancel" /> Cancel action
          </Button>
        ) : null}
      </div>
      <p
        role="status"
        className={`text-sm ${!lobby.ended && (lobby.action.outcome === "blocked" || lobby.action.outcome === "rejected") ? "border-destructive text-destructive border-l-2 pl-2 font-medium" : "text-muted-foreground"}`}
      >
        {lobby.ended ? hint : (lobby.action.feedback ?? hint)}
      </p>
      {!lobby.ended && lobby.action.vote !== undefined ? (
        <p className="text-sm">
          <span>{lobby.action.vote === null
            ? "Abstained"
            : `Your vote: ${lobby.action.vote}`}</span>
          <span> · {lobby.time === DayTime.Day && lobby.setup?.rules.voting.allowRevote ? "Can change" : "Final"}</span>
        </p>
      ) : null}
      {canAbstain(lobby) ? (
        <Button
          size="sm"
          variant="outline"
          onClick={abstain}
          disabled={!lobby.connected}
        >
          <ActionIcon action="abstain" /> Abstain
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
  open,
  onToggle,
  customRoles,
}: {
  name?: string;
  capability?: VisitCapability;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  customRoles?: NonNullable<LobbyState["setup"]>["customRoles"];
}) {
  const role = roleReference(name, customRoles);
  if (!role) return null;
  return (
    <details open={open} onToggle={(event) => onToggle?.(event.currentTarget.open)} className="border-border border-b py-3">
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
    <section className="match-recap space-y-4 border-b border-l-2 border-l-amber-500 py-4 pl-3" aria-label="Match recap">
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
  compact = false,
  onPlayerSelect,
  playerNames = [],
  anonymous = true,
}: {
  messages: LobbyMessage[];
  muted: boolean;
  compact?: boolean;
  onPlayerSelect?: (name: string) => void;
  playerNames?: readonly string[];
  anonymous?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [initialMessages] = useState(() => new Set(messages.map((message) => message.id)));
  const nearBottom = useRef(true);
  const [paused, setPaused] = useState(false);
  const [seen, setSeen] = useState(0);
  const filtered = visibleMessages(messages, muted);
  const unread = paused ? filtered.filter((message) => message.id > seen).length : 0;
  useEffect(() => {
    if (nearBottom.current && ref.current)
      ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages, muted]);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
    <div
      ref={ref}
      onScroll={() => {
        const el = ref.current;
        if (el) {
          const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          if (nearBottom.current && !bottom) setSeen(filtered.at(-1)?.id ?? 0);
          if (bottom !== nearBottom.current) setPaused(!bottom);
          nearBottom.current = bottom;
        }
      }}
      role="log"
      aria-label="Game chat"
      aria-relevant="additions"
      aria-live="polite"
      className="[scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] min-h-0 flex-1 overflow-y-auto py-3"
    >
      {!filtered.length ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          {muted && messages.length
            ? "Bot chatter is muted."
            : "No messages yet."}
        </p>
      ) : (
        filtered.map((message, index) => {
          const { grouped, text } = chatMessagePresentation(
            message,
            filtered[index - 1],
          );
          const event = chatEventStyle(message);
          const prominent = event !== "ordinary" && event !== "vote";
          const Icon = event === "phase-day" ? Sun : event === "phase-night" ? Moon : event === "death" ? Skull : event === "outcome" ? Trophy : Sparkles;
          return (
            <div
              key={message.id}
              data-event={event}
              data-new-event={prominent && !initialMessages.has(message.id) ? "true" : undefined}
              className={prominent ? `chat-event chat-event--${event}` : `${message.kind === "system" && compact ? "mt-1" : grouped ? "pt-1" : "mt-3 pt-2"} ${message.kind === "system" ? `border-border text-muted-foreground ${compact || event === "vote" ? "" : "border-t"} text-xs` : message.kind === "whisper" ? "border-primary/40 text-primary border-l-2 pl-3 text-sm" : message.kind === "role" || message.kind === "spectator" ? "text-primary text-sm" : "text-sm"}`}
            >
              {prominent ? <><Icon size={16} aria-hidden="true" /><p className="min-w-0 leading-5 break-words">{text}</p></> : message.kind === "chat" && message.sender ? (
                <>
                  {!grouped ? (
                    <p className="mb-1 flex items-center gap-2 font-semibold">
                      <PlayerAvatar name={message.sender} anonymous={anonymous} />
                      {onPlayerSelect && playerNames.includes(message.sender) ? <button type="button" className="hover:underline focus-visible:outline focus-visible:outline-2" onClick={() => onPlayerSelect(message.sender!)}>{message.sender}</button> : message.sender}
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
    {unread > 0 ? <button type="button" className="bg-secondary text-foreground absolute bottom-3 right-3 rounded-md border px-3 py-2 text-sm shadow" onClick={() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; nearBottom.current = true; setPaused(false); setSeen(filtered.at(-1)?.id ?? 0); }}>{unread} new {unread === 1 ? "message" : "messages"} ↓</button> : null}
    </div>
  );
});
