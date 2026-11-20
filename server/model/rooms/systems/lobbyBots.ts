import {
  DayTime,
  type GameSnapshot,
  type JoinRoomResult,
} from "@mernmafia/shared/communication/events";
import type { GamePlayerSocket } from "@mernmafia/shared/communication/serverTypes";
import type { ResolvedGameRules } from "@mernmafia/shared/game/gameRules";
import { canPerformVisit } from "@mernmafia/shared/game/playerActionRules";

/** This port deliberately excludes player roles, factions, random assignment and private logs. */
export interface LobbyBotRoom {
  readonly name: string;
  readonly size: number;
  readonly rules: ResolvedGameRules;
  readonly started: boolean;
  readonly gameHasEnded: boolean;
  readonly userList: readonly { socketId: string; isBot: boolean }[];
  addUser(
    socket: GamePlayerSocket,
    identity?: { handle?: string; botSeat?: boolean },
  ): JoinRoomResult;
  handleVote(
    socket: GamePlayerSocket,
    recipient: number | null,
    phase: DayTime,
  ): void;
  handleVisit(
    socket: GamePlayerSocket,
    recipient: number | null,
    phase: DayTime,
  ): void;
  handleSentMessage(
    socket: GamePlayerSocket,
    message: string,
    phase: DayTime,
  ): void;
  readyForRematch(socket: GamePlayerSocket): void;
}
export type BuiltInBotDecision = {
  vote?: number | null;
  visit?: number | null;
  message?: string;
};

function seatHash(value: string): number {
  let result = 0;
  for (const character of value)
    result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}
/** Decisions use exactly one recipient's wire snapshot, never the authoritative room model. */
export function chooseBuiltInBotAction(
  snapshot: GameSnapshot,
  options: ResolvedGameRules["bots"],
): BuiltInBotDecision {
  if (
    !snapshot.started ||
    snapshot.ended ||
    snapshot.participation === "spectator" ||
    snapshot.participation === "eliminated"
  )
    return {};
  const self = snapshot.players.find(
    (player) => player.name === snapshot.playerName,
  );
  if (self?.isAlive === false) return {};
  let candidates = snapshot.players
    .map((player, index) => ({ player, index }))
    .filter(
      ({ player }) =>
        player.name !== snapshot.playerName && player.isAlive !== false,
    );
  if (options.personality === "cautious")
    candidates = candidates.filter(({ player }) => player.connected !== false);
  if (options.difficulty === "challenging")
    candidates.sort(
      (a, b) =>
        (b.player.votesReceived ?? 0) - (a.player.votesReceived ?? 0) ||
        a.player.name.localeCompare(b.player.name),
    );
  else if (options.personality === "deceptive") candidates.reverse();
  const offset =
    options.difficulty === "challenging"
      ? 0
      : seatHash(`${snapshot.playerName}:${snapshot.dayNumber}`) %
        Math.max(1, candidates.length);
  const chosen = candidates[offset];
  const decision: BuiltInBotDecision = {};
  if (
    snapshot.canVote &&
    snapshot.action?.vote === undefined &&
    (snapshot.time === DayTime.Day || snapshot.role?.nightVote)
  ) {
    // Living roles in a Mafia recipient's snapshot identify its known teammates.
    const voteTarget = snapshot.time === DayTime.Night
      ? candidates.find(({ player }) => player.role === undefined)
      : chosen;
    // Cautious casual players avoid an unsupported opening accusation.
    decision.vote =
      snapshot.time === DayTime.Day &&
      options.difficulty === "casual" &&
      snapshot.dayNumber <= 1
        ? null
        : (voteTarget?.index ?? null);
  }
  if (snapshot.role && snapshot.action?.visit === undefined) {
    const visit = [
      ...candidates,
      ...snapshot.players
        .map((player, index) => ({ player, index }))
        .filter(({ player }) => player.name === snapshot.playerName),
    ].find(({ player }) =>
      canPerformVisit({
        time: snapshot.time,
        isSelf: player.name === snapshot.playerName,
        targetAlive: player.isAlive !== false,
        actorAlive: self?.isAlive !== false,
        actorRole: snapshot.role!.role,
        targetRole: player.role,
        capability: snapshot.role!,
      }),
    );
    if (visit) decision.visit = visit.index;
  }
  if (snapshot.canTalk && snapshot.time === DayTime.Day) {
    decision.message =
      options.personality === "argumentative"
        ? "Which public claim should we challenge before voting?"
        : options.personality === "deceptive"
          ? "I will keep my role private while we compare the public claims."
          : "Let us compare the public evidence before deciding.";
  }
  return decision;
}

/** Event-driven scripted seats: no paid model calls, global state or background timers. */
export class LobbyBots {
  private readonly sockets = new Map<string, GamePlayerSocket>();
  private readonly pending = new Map<string, GameSnapshot>();
  private readonly acted = new Map<string, string>();
  private filling = false;
  private disposed = false;
  constructor(private readonly room: LobbyBotRoom) {}

  fillSeats(): void {
    if (
      this.disposed ||
      this.filling ||
      !this.room.rules.bots.fillEmptySeats ||
      this.room.started ||
      this.room.gameHasEnded ||
      !this.room.userList.some((user) => !user.isBot)
    )
      return;
    this.filling = true;
    try {
      for (
        let seat = this.room.userList.length;
        seat < this.room.size;
        seat++
      ) {
        const id = `builtin-bot:${this.room.name}:${seat}`;
        const socket: GamePlayerSocket = { id, data: {}, join() {} };
        this.sockets.set(id, socket);
        const result = this.room.addUser(socket, {
          handle: `Bot ${seat + 1}`,
          botSeat: true,
        });
        if (result.status !== "joined") {
          this.sockets.delete(id);
          break;
        }
      }
    } finally {
      this.filling = false;
    }
  }

  onSnapshot(socketId: string, snapshot: GameSnapshot): void {
    if (this.disposed || !this.sockets.has(socketId)) return;
    const alreadyQueued = this.pending.has(socketId);
    this.pending.set(socketId, snapshot);
    if (!alreadyQueued) queueMicrotask(() => this.flush(socketId));
  }

  private flush(socketId: string): void {
    const snapshot = this.pending.get(socketId),
      socket = this.sockets.get(socketId);
    this.pending.delete(socketId);
    if (this.disposed || !snapshot || !socket) return;
    const key = `${snapshot.matchId}:${snapshot.phaseVersion}:${snapshot.ended ? "ended" : snapshot.time}`;
    if (this.acted.get(socketId) === key) return;
    this.acted.set(socketId, key);
    if (snapshot.ended) {
      this.room.readyForRematch(socket);
      return;
    }
    const action = chooseBuiltInBotAction(snapshot, this.room.rules.bots);
    if (action.message)
      this.room.handleSentMessage(socket, action.message, snapshot.time);
    if (action.visit !== undefined)
      this.room.handleVisit(socket, action.visit, snapshot.time);
    if (action.vote !== undefined)
      this.room.handleVote(socket, action.vote, snapshot.time);
  }
  dispose(): void {
    this.disposed = true;
    this.pending.clear();
    this.sockets.clear();
    this.acted.clear();
  }
}
