import type {
  ActionSelection,
  MatchRecap,
  MatchTimelineEntry,
} from "@mernmafia/shared/game/matchExperience";
import type { LobbyConfig } from "@mernmafia/shared/game/lobbyConfig";
import { RoleHandler } from "./initRoles/roleHandler.js";
import { User } from "../user/user.js";
import { Player } from "../player/player.js";
import type { GamePlayerSocket } from "@mernmafia/shared/communication/serverTypes";
import {
  ActionKind,
  DayTime,
  GameOutcome,
  JoinRoomResultCode,
  ServerEvent,
  type GameEndResult,
  type JoinRoomResult,
} from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io, setGameEmitter } from "../../servers/emitter.js";
import type { GameEmitter } from "@mernmafia/shared/communication/serverTypes";
import type { GameFaction } from "../factions/factionContracts.js";
import { RoleGroup } from "../roles/roleGroup.js";
import { CombatLevel } from "../roles/combatLevel.js";
import { clientPhaseMatchesRoomPhase, GamePhase } from "./gamePhase.js";
import { names } from "../player/names/namesList.js";
import { GameSystems } from "./systems/gameSystems.js";
import { RoomMessenger } from "./roomMessenger.js";
import { PhaseScheduler } from "./systems/phaseScheduler.js";
import { resolveDayVote, type DayVoteOutcome } from "./systems/voteSystem.js";
import { determineWinningFaction } from "./systems/victoryResolution.js";
import {
  persistMatchHistory,
  rotateActiveRoom,
  type MatchHistoryEvent,
  type BackendContext,
} from "../../data/matchHistory.js";

const DEFAULT_END_DAY_COUNT = 3;
const SESSION_LENGTH_PER_PLAYER_MS = 4000;
const DAY_START_TIME_LEFT_SECONDS = 5;
const DAY_START_DELAY_MS = 5000;
const NIGHT_START_DELAY_MS = 15000;
const NIGHT_TIME_LEFT_SECONDS = 15;
const DAY_END_EXTRA_SECONDS = 10;
const MAX_GAME_DAYS = 25;
const DRAW_TRIGGER_DAYS = 3;
const WHISPER_OVERHEARD_PROBABILITY = 0.1;
const VOTE_QUORUM_OFFSET = 1;

function createRoomName(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export class Room {
  readonly name: string;
  readonly size: number;
  readonly messenger: RoomMessenger;
  phaseVersion = 0;
  private round = 0;
  private randomSource: () => number = Math.random;
  private readonly roomEmitter?: GameEmitter;
  private readonly phaseScheduler = new PhaseScheduler(() => this.gameHasEnded);

  /** Users connected in the lobby (before the game starts). */
  userList: User[] = [];
  /** Observers never occupy game seats or participate in role assignment. */
  spectatorList: User[] = [];
  /** Players active in the game. Populated from userList when the game starts. */
  playerList: Player[] = [];

  started = false;
  time: GamePhase = GamePhase.Idle;
  roleList: ReturnType<RoleHandler["assignGame"]> = [];
  factionList: GameFaction[] = [];
  systems: GameSystems | null = null;
  sessionLength: number;
  gameHasEnded = false;
  endDay = DEFAULT_END_DAY_COUNT;
  confesserVotedOut = false;

  private dayNumber = 0;
  private phaseEndsAt = 0;
  startedAt = new Date();
  timeline: MatchTimelineEntry[] = [];
  recap?: MatchRecap;
  readyPlayers = new Set<string>();
  private selections = new Map<string, ActionSelection>();
  conversationHistory: MatchHistoryEvent[] = [];
  actionHistory: MatchHistoryEvent[] = [];

  constructor(
    size: number,
    name?: string,
    emitter?: GameEmitter,
    readonly lobbyConfig?: LobbyConfig,
    private readonly backend?: BackendContext,
  ) {
    this.name = name ?? createRoomName();
    this.size = size;
    this.roomEmitter = emitter;
    this.sessionLength = this.size * SESSION_LENGTH_PER_PLAYER_MS;
    this.messenger = new RoomMessenger(this.name);
  }

  /** Selects this room's transport before game logic emits any events. */
  private activateEmitter(): void {
    if (this.roomEmitter) setGameEmitter(this.roomEmitter);
  }

  /**
   * Overrides the random source used by room-scoped systems and composed handlers.
   *
   * @param source - Deterministic or custom random function.
   */
  setRandomSource(source: () => number): void {
    this.randomSource = source;
  }

  /**
   * Returns a room-scoped random float in the range [0, 1).
   *
   * @returns Random float.
   */
  random(): number {
    return this.randomSource();
  }

  /**
   * Returns a room-scoped random array index.
   *
   * @param length - Length of the target collection.
   * @returns Random integer index.
   */
  randomIndex(length: number): number {
    return Math.floor(this.random() * length);
  }

  recordConversation(
    content: string,
    actor?: string,
    target?: string,
    type: MatchHistoryEvent["type"] = "chat",
  ) {
    if (this.conversationHistory.length >= 1000)
      this.conversationHistory.shift();
    this.conversationHistory.push({
      time: Date.now(),
      type,
      actor,
      target,
      content,
    });
  }

  private recordAction(content: ActionKind, actor?: string, target?: string) {
    if (this.actionHistory.length >= 1000) this.actionHistory.shift();
    this.actionHistory.push({
      time: Date.now(),
      type: "action",
      actor,
      target,
      content,
      phase: this.time,
      day: this.dayNumber,
      kind:
        content === ActionKind.Vote
          ? "vote"
          : content === ActionKind.NightVisit
            ? "night_action"
            : undefined,
    });
  }

  /** Returns the active Player for a given socket, or null if not found. */
  private getPlayerFromSocket(socket: GamePlayerSocket): Player | null {
    const user = this.getUserFromSocket(socket);
    if (!user) return null;
    return this.playerList.find((p) => p.user === user) ?? null;
  }

  private getUserAt(index: number): User | null {
    return this.userList[index] ?? null;
  }

  private getUserFromSocket(socket: GamePlayerSocket): User | null {
    const position = socket.data.position;
    if (typeof position !== "number") return null;
    const user = this.getUserAt(position);
    return user?.socketId === socket.id ? user : null;
  }

  private getPlayerAt(index: number): Player | null {
    return this.playerList[index] ?? null;
  }

  private isActionInWrongPhase(phase: DayTime): boolean {
    return !clientPhaseMatchesRoomPhase(phase, this.time);
  }

  /**
   * Adds a connected client to the lobby.
   * Returns an error code on failure or the assigned username on success.
   */
  addUser(
    playerSocket: GamePlayerSocket,
    identity?: { userId?: string; handle?: string; botSeat?: boolean },
  ): JoinRoomResult {
    this.activateEmitter();
    const socketId = playerSocket.id;
    if (this.userList.some((u) => u.socketId === socketId))
      return { status: "rejected", code: JoinRoomResultCode.GenericError };
    if (this.userList.length >= this.size) {
      if (!this.lobbyConfig)
        void rotateActiveRoom(this.backend).catch((error) => {
          console.error("Failed to rotate active room", error);
        });
      return { status: "rejected", code: JoinRoomResultCode.RoomFull };
    }

    const takenNames = [...this.userList, ...this.spectatorList].map(
      (u) => u.username,
    );
    const preferredName = identity?.handle?.trim().slice(0, 24);
    const username =
      preferredName && !takenNames.includes(preferredName)
        ? preferredName
        : names.find((n) => !takenNames.includes(n));
    if (!username) {
      return { status: "rejected", code: JoinRoomResultCode.GenericError };
    }

    const user = new User(playerSocket, username, identity?.userId);
    user.isBot = identity?.botSeat === true;
    const position = this.userList.push(user) - 1;
    playerSocket.data.position = position;

    this.emitUserList(socketId);
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.PlayerJoinedRoom,
      params: { playerName: username },
    });
    this.recordConversation(`${username} has joined the room!`, username);
    io.to(this.name).emit(ServerEvent.ReceiveNewPlayer, { name: username });

    if (!this.gameHasEnded && this.userList.length === this.size) {
      this.started = true;
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.RoomFullStartingGame,
      });
      if (!this.lobbyConfig)
        void rotateActiveRoom(this.backend).catch((error) => {
          console.error("Failed to rotate active room", error);
        });
      this.startGame();
    }

    this.broadcastSnapshots();
    return { status: "joined", username };
  }

  addSpectator(
    socket: GamePlayerSocket,
    identity?: { userId?: string; handle?: string },
  ): JoinRoomResult {
    this.activateEmitter();
    if (
      this.spectatorList.length >= 50 ||
      [...this.userList, ...this.spectatorList].some(
        (user) => user.socketId === socket.id,
      )
    )
      return { status: "rejected", code: JoinRoomResultCode.RoomFull };
    const requested = identity?.handle?.trim().slice(0, 24) || "Spectator";
    const names = new Set(
      [...this.userList, ...this.spectatorList].map((user) => user.username),
    );
    let username = requested;
    for (let suffix = 2; names.has(username); suffix++)
      username = `${requested} ${suffix}`;
    const user = new User(socket, username, identity?.userId);
    this.spectatorList.push(user);
    socket.data.roomObject = this;
    socket.join(this.name);
    this.broadcastSnapshots();
    return { status: "joined", username };
  }

  /** Rebinds a reserved seat, retaining its role, votes, and phase actions. */
  resumeUser(
    previousSocketId: string,
    socket: GamePlayerSocket,
  ): JoinRoomResult {
    const index = this.userList.findIndex(
      (user) => user.socketId === previousSocketId,
    );
    if (index < 0) {
      const observer = this.spectatorList.find(
        (entry) => entry.socketId === previousSocketId,
      );
      if (!observer)
        return { status: "rejected", code: JoinRoomResultCode.GenericError };
      observer.socket = socket;
      observer.socketId = socket.id;
      observer.connected = true;
      socket.data.roomObject = this;
      socket.join(this.name);
      this.broadcastSnapshots();
      return { status: "joined", username: observer.username };
    }
    const user = this.userList[index];
    user.connected = true;
    user.hasDeparted = false;
    user.socket = socket;
    user.socketId = socket.id;
    socket.data.position = index;
    socket.data.roomObject = this;
    socket.join(this.name);
    this.broadcastSnapshots();
    return { status: "joined", username: user.username };
  }

  sendSnapshot(socketId: string): void {
    this.activateEmitter();
    const spectator = this.spectatorList.find(
      (entry) => entry.socketId === socketId,
    );
    const user =
      this.userList.find((entry) => entry.socketId === socketId) ?? spectator;
    if (!user) return;
    const player = this.playerList.find((entry) => entry.user === user);
    const role = player?.role;
    const faction = this.factionList.find((entry) =>
      entry.memberList.includes(player!),
    );
    io.to(socketId).emit(ServerEvent.GameSnapshot, {
      capacity: this.size,
      participation: spectator
        ? "spectator"
        : player && !player.isAlive
          ? "eliminated"
          : "player",
      spectatorCount: this.spectatorList.filter((entry) => entry.connected)
        .length,
      matchId: `${this.name}:${this.startedAt.toISOString()}:${this.round}`,
      started: this.started,
      ended: this.gameHasEnded,
      action: spectator ? {} : (this.selections.get(user.username) ?? {}),
      voteVisibility: this.lobbyConfig?.voteVisibility ?? "public",
      timeline: this.timeline.slice(-100),
      recap: this.recap,
      readyPlayers: [...this.readyPlayers],
      phaseVersion: this.phaseVersion,
      playerName: user.username,
      players: this.userList.map((entry) => {
        const other = this.playerList.find(
          (candidate) => candidate.user === entry,
        );
        return {
          name: entry.username,
          connected: entry.connected,
          isBot: entry.isBot,
          ...(this.time === GamePhase.Day &&
          this.lobbyConfig?.voteVisibility !== "hidden" &&
          other
            ? {
                votesReceived: other.votesReceived,
                voteStatus: other.hasVoted
                  ? other.voteTarget === null
                    ? ("abstained" as const)
                    : ("voted" as const)
                  : ("pending" as const),
                voteTarget: other.voteTarget ?? undefined,
              }
            : {}),
          isAlive: this.started ? other?.isAlive : undefined,
          role:
            other &&
            (this.gameHasEnded ||
              !other.isAlive ||
              other === player ||
              faction?.memberList.includes(other))
              ? other.role.name
              : undefined,
        };
      }),
      role: role
        ? {
            name: user.username,
            role: role.name,
            dayVisitSelf: role.dayVisitSelf,
            dayVisitOthers: role.dayVisitOthers,
            dayVisitFaction: role.dayVisitFaction,
            nightVisitSelf: role.nightVisitSelf,
            nightVisitOthers: role.nightVisitOthers,
            nightVisitFaction: role.nightVisitFaction,
            nightVote: role.nightVote,
          }
        : undefined,
      time:
        this.time === GamePhase.Night || this.time === GamePhase.Processing
          ? DayTime.Night
          : DayTime.Day,
      dayNumber: this.dayNumber,
      timeLeft: Math.max(0, Math.ceil((this.phaseEndsAt - Date.now()) / 1000)),
      canTalk:
        !this.gameHasEnded &&
        (Boolean(spectator) || !player || !player.isAlive || !role?.silenced),
      canVote:
        !this.gameHasEnded &&
        !this.confesserVotedOut &&
        !spectator &&
        (!player || player.isAlive),
    });
  }

  broadcastSnapshots(): void {
    for (const user of [...this.userList, ...this.spectatorList])
      if (user.connected) this.sendSnapshot(user.socketId);
  }

  setConnected(socketId: string, connected: boolean): void {
    const user = [...this.userList, ...this.spectatorList].find(
      (entry) => entry.socketId === socketId,
    );
    if (user) {
      user.connected = connected;
      this.broadcastSnapshots();
    }
  }

  recordTimeline(text: string): void {
    if (this.actionHistory.length >= 1000) this.actionHistory.shift();
    this.actionHistory.push({
      time: Date.now(),
      type: "system",
      content: text,
      phase: this.time,
      day: this.dayNumber,
      kind: /began\.$/.test(text)
        ? "phase"
        : /died|voted out/.test(text)
          ? "death"
          : /won\.|draw/.test(text)
            ? "outcome"
            : undefined,
    });
    this.timeline.push({
      id: (this.timeline.at(-1)?.id ?? 0) + 1,
      day: this.dayNumber,
      phase: this.time === GamePhase.Day ? DayTime.Day : DayTime.Night,
      text,
    });
    this.timeline = this.timeline.slice(-100);
  }

  actionFeedback(
    player: Player,
    feedback: string,
    outcome: ActionSelection["outcome"],
  ): void {
    if (this.actionHistory.length >= 1000) this.actionHistory.shift();
    this.actionHistory.push({
      time: Date.now(),
      type: "system",
      actor: player.username,
      content: feedback,
      phase: this.time,
      day: this.dayNumber,
      kind: "night_action",
    });
    this.selections.set(player.username, {
      ...this.selections.get(player.username),
      feedback,
      outcome,
    });
    if (this.time !== GamePhase.Processing)
      this.sendSnapshot(player.user.socketId);
  }

  readyForRematch(socket: GamePlayerSocket): void {
    const user = this.getUserFromSocket(socket);
    if (!this.gameHasEnded || !user) return;
    this.readyPlayers.add(user.username);
    if (
      this.userList.length !== this.size ||
      !this.userList.every(
        (entry) => entry.connected && this.readyPlayers.has(entry.username),
      )
    ) {
      this.broadcastSnapshots();
      return;
    }
    this.gameHasEnded = false;
    this.started = true;
    this.recap = undefined;
    this.readyPlayers.clear();
    this.selections.clear();
    this.timeline = [];
    this.conversationHistory = [];
    this.actionHistory = [];
    this.playerList = [];
    this.roleList = [];
    this.factionList = [];
    this.systems = null;
    this.confesserVotedOut = false;
    this.endDay = DEFAULT_END_DAY_COUNT;
    this.round++;
    this.startedAt = new Date();
    void this.startGame();
  }

  /** Handles a connected user leaving (pre-game removal or in-game death by abandonment). */
  removePlayer(socketId: string) {
    this.activateEmitter();
    const observerIndex = this.spectatorList.findIndex(
      (entry) => entry.socketId === socketId,
    );
    if (observerIndex >= 0) {
      this.spectatorList.splice(observerIndex, 1);
      this.broadcastSnapshots();
      return;
    }
    if (this.gameHasEnded) {
      const index = this.userList.findIndex(
        (user) => user.socketId === socketId,
      );
      if (index < 0) return;
      this.readyPlayers.delete(this.userList[index].username);
      this.userList.splice(index, 1);
      this.userList.forEach((user, position) => {
        user.socket.data.position = position;
      });
      this.broadcastSnapshots();
      return;
    }

    if (!this.started) {
      const index = this.userList.findIndex((u) => u.socketId === socketId);
      if (index === -1) return;
      const user = this.userList[index];
      io.to(this.name).emit(ServerEvent.RemovePlayer, { name: user.username });
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.PlayerLeftRoom,
        params: { playerName: user.username },
      });
      this.recordConversation(
        `${user.username} has left the room!`,
        user.username,
      );
      this.userList.splice(index, 1);
      for (const [i, u] of this.userList.entries()) {
        u.socket.data.position = i;
      }
    } else {
      const player = this.playerList.find((p) => p.user.socketId === socketId);
      if (!player) return;
      player.user.hasDeparted = true;
      player.user.connected = false;
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.PlayerAbandonedGame,
        params: { playerName: player.username },
      });
      player.role.damage = CombatLevel.Fatal;
      this.broadcastSnapshots();
    }
  }

  emitUserList(target: string) {
    this.activateEmitter();
    const list = this.userList.map((u) => {
      const player = this.playerList.find((p) => p.user === u);
      return {
        name: u.username,
        isAlive: this.started ? (player?.isAlive ?? false) : undefined,
        role:
          this.started && player && !player.isAlive
            ? player.role.name
            : undefined,
      };
    });
    io.to(target).emit(ServerEvent.ReceivePlayerList, list);
  }

  handleSentMessage(
    playerSocket: GamePlayerSocket,
    message: string,
    phase: DayTime,
  ) {
    this.activateEmitter();
    if (this.gameHasEnded) return;
    const observer = this.spectatorList.find(
      (entry) => entry.socketId === playerSocket.id,
    );
    const eliminated = this.getPlayerFromSocket(playerSocket);
    if (observer || (eliminated && !eliminated.isAlive)) {
      const username = observer?.username ?? eliminated!.username;
      for (const user of [
        ...this.spectatorList,
        ...this.playerList
          .filter((player) => !player.isAlive)
          .map((player) => player.user),
      ])
        if (user.connected)
          io.to(user.socketId).emit(
            ServerEvent.ReceiveSpectatorMessage,
            `${username}: ${message}`,
          );
      return;
    }
    if (!this.started) {
      this.handleLobbyMessage(playerSocket, message);
      return;
    }

    if (this.isActionInWrongPhase(phase)) return;
    this.handleGameMessage(playerSocket, message);
  }

  private handleGameMessage(
    playerSocket: GamePlayerSocket,
    message: string,
  ): void {
    const player = this.getPlayerFromSocket(playerSocket);
    if (!player) return;

    if (player.isAlive) {
      player.role.handleMessage(message);
    } else {
      io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotSpeakYouAreDead,
      });
    }
  }

  private handleLobbyMessage(
    playerSocket: GamePlayerSocket,
    message: string,
  ): void {
    const user = this.getUserFromSocket(playerSocket);
    if (!user) return;

    io.to(this.name).emit(
      ServerEvent.ReceiveChatMessage,
      `${user.username}: ${message}`,
    );
    this.recordConversation(message, user.username);
  }

  handleVote(
    playerSocket: GamePlayerSocket,
    recipient: number | null,
    phase: DayTime,
  ) {
    this.activateEmitter();
    if (this.gameHasEnded || !this.started || this.isActionInWrongPhase(phase))
      return;

    const foundPlayer = this.getPlayerFromSocket(playerSocket);
    const foundRecipient =
      recipient === null ? null : this.getPlayerAt(recipient);
    if (
      !foundPlayer ||
      !foundPlayer.isAlive ||
      (recipient !== null && !foundRecipient)
    )
      return;
    if (recipient === null) {
      if (
        foundPlayer.hasVoted ||
        this.confesserVotedOut ||
        this.time !== GamePhase.Day
      )
        return;
      foundPlayer.hasVoted = true;
      foundPlayer.voteTarget = null;
      this.selections.set(foundPlayer.username, {
        ...this.selections.get(foundPlayer.username),
        vote: null,
        feedback: "You abstained from this vote.",
        outcome: "submitted",
      });
      this.broadcastSnapshots();
      return;
    }
    if (!foundRecipient || !foundRecipient.isAlive) return;

    if (foundPlayer.hasVoted) {
      io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotChangeVote,
      });
      return;
    }

    if (foundPlayer === foundRecipient) {
      io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotVoteForYourself,
      });
      return;
    }

    if (this.time !== GamePhase.Day) {
      if (!foundPlayer.role.nightVote) {
        io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
          key: MessageKey.CannotVoteAtNight,
        });
        return;
      }
      foundPlayer.hasVoted = true;
      foundPlayer.voteTarget = foundRecipient.username;
      this.selections.set(foundPlayer.username, {
        ...this.selections.get(foundPlayer.username),
        vote: foundRecipient.username,
        feedback: `Night vote submitted for ${foundRecipient.username}.`,
        outcome: "submitted",
      });
      this.systems?.roleCommands.runNightVote(foundPlayer, foundRecipient);
      this.sendSnapshot(playerSocket.id);
      return;
    }

    if (this.confesserVotedOut) {
      io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.VotingDisabledConfeser,
      });
      return;
    }

    if (!foundRecipient.isAlive) {
      io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.VoteInvalid,
      });
      return;
    }

    this.recordAction(
      ActionKind.Vote,
      foundPlayer.username,
      foundRecipient.username,
    );
    foundPlayer.hasVoted = true;
    foundRecipient.votesReceived++;
    foundPlayer.voteTarget = foundRecipient.username;
    this.selections.set(foundPlayer.username, {
      ...this.selections.get(foundPlayer.username),
      vote: foundRecipient.username,
      feedback: `Vote submitted for ${foundRecipient.username}.`,
      outcome: "submitted",
    });
    const voteMsg =
      foundRecipient.votesReceived > 1
        ? {
            key: MessageKey.VoteCastMultipleVotes,
            params: {
              voterName: foundPlayer.username,
              targetName: foundRecipient.username,
              count: foundRecipient.votesReceived,
            },
          }
        : {
            key: MessageKey.VoteCastSingleVote,
            params: {
              voterName: foundPlayer.username,
              targetName: foundRecipient.username,
            },
          };
    if (this.lobbyConfig?.voteVisibility !== "hidden") {
      io.to(this.name).emit(ServerEvent.ReceiveMessage, voteMsg);
      this.recordTimeline(
        `${foundPlayer.username} voted for ${foundRecipient.username}.`,
      );
    }
    this.broadcastSnapshots();
  }

  handleWhisper(
    playerSocket: GamePlayerSocket,
    recipient: number,
    message: string,
    phase: DayTime,
  ) {
    this.activateEmitter();
    if (this.gameHasEnded || !this.started || this.isActionInWrongPhase(phase))
      return;

    const foundPlayer = this.getPlayerFromSocket(playerSocket);
    const foundRecipient = this.getPlayerAt(recipient);
    if (
      !foundPlayer ||
      !foundRecipient ||
      !foundPlayer.isAlive ||
      foundPlayer.role.silenced
    )
      return;

    if (this.time === GamePhase.Night) {
      io.to(foundPlayer.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.CannotWhisperAtNight,
      });
      return;
    }

    if (!foundRecipient.isAlive) {
      io.to(foundPlayer.user.socketId).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.InvalidWhisperRecipient,
      });
      return;
    }

    this.recordAction(
      ActionKind.Whisper,
      foundPlayer.username,
      foundRecipient.username,
    );

    if (WHISPER_OVERHEARD_PROBABILITY > this.random()) {
      this.broadcastWhisperOverheard(foundPlayer, foundRecipient, message);
      return;
    }

    this.actionFeedback(
      foundPlayer,
      `Whisper sent to ${foundRecipient.username}.`,
      "submitted",
    );
    this.deliverWhisper(foundPlayer, foundRecipient, message);
    this.notifyWhisperTappers(foundPlayer, foundRecipient, message);
  }

  private broadcastWhisperOverheard(
    sender: Player,
    recipient: Player,
    message: string,
  ): void {
    io.to(sender.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.WhispersOverheardBySender,
    });
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.WhisperOverheardBroadcast,
      params: {
        senderName: sender.username,
        message,
        recipientName: recipient.username,
      },
    });
  }

  private deliverWhisper(
    sender: Player,
    recipient: Player,
    message: string,
  ): void {
    io.to(recipient.user.socketId).emit(
      ServerEvent.ReceiveWhisperMessage,
      `Whisper from ${sender.username}: ${message}`,
    );
    this.recordConversation(
      message,
      sender.username,
      recipient.username,
      "whisper",
    );
    io.to(sender.user.socketId).emit(
      ServerEvent.ReceiveWhisperMessage,
      `Whisper to ${recipient.username}: ${message}`,
    );
  }

  private notifyWhisperTappers(
    sender: Player,
    recipient: Player,
    message: string,
  ): void {
    const tappedMessage = `${sender.username} whispered "${message}" to ${recipient.username}.`;

    const senderTap = sender.role.dayTappedBy;
    if (senderTap !== null) {
      io.to(senderTap.player.user.socketId).emit(
        ServerEvent.ReceiveWhisperMessage,
        tappedMessage,
      );
    }

    const recipientTap = recipient.role.dayTappedBy;
    if (recipientTap !== null) {
      io.to(recipientTap.player.user.socketId).emit(
        ServerEvent.ReceiveWhisperMessage,
        tappedMessage,
      );
    }
  }

  handleVisit(
    playerSocket: GamePlayerSocket,
    recipient: number | null,
    phase: DayTime,
  ) {
    this.activateEmitter();
    if (this.gameHasEnded || !this.started || this.isActionInWrongPhase(phase))
      return;

    const foundPlayer = this.getPlayerFromSocket(playerSocket);
    const foundRecipient =
      recipient !== null ? this.getPlayerAt(recipient) : null;
    if (
      !foundPlayer ||
      !foundPlayer.isAlive ||
      (recipient !== null && !foundRecipient)
    )
      return;

    if (this.time === GamePhase.Day) {
      this.handleDayVisit(foundPlayer, foundRecipient);
    } else if (this.time === GamePhase.Night) {
      this.handleNightVisit(foundPlayer, playerSocket, foundRecipient);
    }
  }

  private handleDayVisit(foundPlayer: Player, foundRecipient: Player | null) {
    if (foundRecipient === null) {
      foundPlayer.role.cancelDayAction();
      this.selections.set(foundPlayer.username, {
        ...this.selections.get(foundPlayer.username),
        visit: null,
      });
      this.actionFeedback(foundPlayer, "Day action cancelled.", "submitted");
      return;
    }

    this.recordAction(
      ActionKind.DayVisit,
      foundPlayer.username,
      foundRecipient.username,
    );
    const accepted = foundPlayer.role.handleDayAction(foundRecipient);
    if (accepted === false) {
      this.actionFeedback(
        foundPlayer,
        "That day action was not accepted. Check your role restrictions.",
        "rejected",
      );
      return;
    }
    this.selections.set(foundPlayer.username, {
      ...this.selections.get(foundPlayer.username),
      visit: foundPlayer.role.dayVisiting?.player.username ?? null,
    });
    this.actionFeedback(
      foundPlayer,
      foundPlayer.role.dayVisiting
        ? `Day action selected: ${foundPlayer.role.dayVisiting.player.username}.`
        : "No day action selected.",
      "submitted",
    );
  }

  private handleNightVisit(
    foundPlayer: Player,
    playerSocket: GamePlayerSocket,
    foundRecipient: Player | null,
  ) {
    if (foundPlayer.role.roleblocked) {
      io.to(playerSocket.id).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.RoleblockedCannotCommand,
      });
      this.actionFeedback(
        foundPlayer,
        "Your night action was blocked.",
        "blocked",
      );
      return;
    }

    if (foundRecipient === null) {
      foundPlayer.role.cancelNightAction();
      this.selections.set(foundPlayer.username, {
        ...this.selections.get(foundPlayer.username),
        visit: null,
      });
      this.actionFeedback(foundPlayer, "Night action cancelled.", "submitted");
      return;
    }

    this.recordAction(
      ActionKind.NightVisit,
      foundPlayer.username,
      foundRecipient.username,
    );
    const accepted = foundPlayer.role.handleNightAction(foundRecipient);
    if (accepted === false) {
      this.actionFeedback(
        foundPlayer,
        "That night action was not accepted. Check your role restrictions.",
        "rejected",
      );
      return;
    }
    this.selections.set(foundPlayer.username, {
      ...this.selections.get(foundPlayer.username),
      visit: foundPlayer.role.visiting?.player.username ?? null,
    });
    this.actionFeedback(
      foundPlayer,
      foundPlayer.role.visiting
        ? `Night action selected: ${foundPlayer.role.visiting.player.username}. You can change it until dawn.`
        : "No night action selected.",
      "submitted",
    );
  }

  async startGame() {
    this.activateEmitter();
    if (this.gameHasEnded) return;

    const roleHandler = new RoleHandler(this.userList.length, [], () =>
      this.random(),
    );
    this.roleList.push(...roleHandler.assignGame(this.lobbyConfig));

    let currentIndex = this.roleList.length;
    while (currentIndex !== 0) {
      const randomIndex = this.randomIndex(currentIndex);
      currentIndex--;
      [this.roleList[currentIndex], this.roleList[randomIndex]] = [
        this.roleList[randomIndex],
        this.roleList[currentIndex],
      ];
    }

    for (const [index, user] of this.userList.entries()) {
      user.socket.data.position = index;
      const player = new Player(user);
      this.playerList.push(player);

      const RoleClassOrDef = this.roleList[index];
      if (!RoleClassOrDef) {
        console.error(
          `No role class found at index ${index} — roleList has ${this.roleList.length} entries`,
        );
        continue;
      }

      // Use roleHandler to instantiate (handles both classes and custom definitions)
      const role = roleHandler.instantiateRole(RoleClassOrDef, this, player);
      player.assignRole(role);
      this.actionHistory.push({
        time: Date.now(),
        type: "system",
        actor: player.username,
        content: role.name,
        phase: "starting",
        day: 0,
        kind: "role_reveal",
      });

      io.to(user.socketId).emit(ServerEvent.AssignPlayerRole, {
        name: player.username,
        role: role.name,
        dayVisitSelf: role.dayVisitSelf,
        dayVisitOthers: role.dayVisitOthers,
        dayVisitFaction: role.dayVisitFaction,
        nightVisitSelf: role.nightVisitSelf,
        nightVisitOthers: role.nightVisitOthers,
        nightVisitFaction: role.nightVisitFaction,
        nightVote: role.nightVote,
      });
    }

    this.factionList.push(
      ...roleHandler.assignFactionsFromPlayerList(this.playerList, this),
    );
    for (const faction of this.factionList)
      faction.findMembers(this.playerList);
    this.systems = new GameSystems(this);

    this.startFirstDaySession(this.sessionLength);
    // The first snapshot resets client state for the new match. Initial role
    // clues must follow it so that clients retain them in the new history.
    for (const player of this.playerList) player.role.initRole();
    this.emitUserList(this.name);
    for (const user of this.userList) this.sendSnapshot(user.socketId);
  }

  startFirstDaySession(sessionLength: number) {
    this.activateEmitter();
    if (this.gameHasEnded) return;
    this.phaseVersion++;
    this.time = GamePhase.Day;
    this.dayNumber = 1;
    this.recordTimeline("Day 1 began.");
    this.phaseEndsAt = Date.now() + DAY_START_DELAY_MS;
    this.broadcastSnapshots();
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.Day1Started,
    });
    io.to(this.name).emit(ServerEvent.UpdateDayTime, {
      phaseVersion: this.phaseVersion,
      time: DayTime.Day,
      dayNumber: 1,
      timeLeft: DAY_START_TIME_LEFT_SECONDS,
    });
    this.phaseScheduler.schedule(DAY_START_DELAY_MS, () => {
      this.activateEmitter();
      if (this.gameHasEnded) return;
      for (const player of this.playerList) {
        if (player.isAlive) player.role.dayVisit();
      }
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.Night1Started,
      });
      this.startNightSession(1, sessionLength);
    });
  }

  startDaySession(dayNumber: number, sessionLength: number) {
    this.activateEmitter();
    if (this.gameHasEnded) return;
    this.phaseVersion++;
    this.time = GamePhase.Day;
    this.dayNumber = dayNumber;
    this.recordTimeline(`Day ${dayNumber} began.`);
    for (const player of this.playerList) {
      const previous = this.selections.get(player.username);
      this.selections.set(player.username, {
        feedback: previous?.feedback,
        outcome: previous?.outcome,
      });
    }
    this.phaseEndsAt =
      Date.now() + sessionLength + DAY_END_EXTRA_SECONDS * 1000;

    if (this.shouldEndGameForNoDeath(dayNumber)) {
      this.endGameNobodyDied();
      return;
    }

    if (this.endDay - 1 <= dayNumber) {
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.DrawWarnOneDay,
      });
    }

    io.to(this.name).emit(ServerEvent.UpdateDayTime, {
      phaseVersion: this.phaseVersion,
      time: DayTime.Day,
      dayNumber,
      timeLeft: Math.floor(sessionLength / 1000 + DAY_END_EXTRA_SECONDS),
    });
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.DayNStarted,
      params: { dayNumber },
    });

    const livingPlayerList = this.getLivingPlayers();
    const votesRequired =
      Math.floor(livingPlayerList.length / 2) + VOTE_QUORUM_OFFSET;

    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.VotesRequired,
      params: { count: votesRequired },
    });

    this.broadcastSnapshots();
    this.phaseScheduler.schedule(
      sessionLength + DAY_END_EXTRA_SECONDS * 1000,
      () =>
        this.processDayEnd(
          dayNumber,
          sessionLength,
          livingPlayerList,
          votesRequired,
        ),
    );
  }

  private shouldEndGameForNoDeath(dayNumber: number): boolean {
    return this.endDay <= dayNumber;
  }

  private endGameNobodyDied(): void {
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.GameEndedNobodyDied,
    });
    this.systems?.victory.onNoDeathDraw();
    this.endGame({ outcome: GameOutcome.Draw });
  }

  private getLivingPlayers(): Player[] {
    const livingPlayerList: Player[] = [];
    for (const player of this.playerList) {
      if (player.isAlive) {
        player.role.dayUpdate();
        player.hasVoted = false;
        player.voteTarget = undefined;
        player.votesReceived = 0;
        livingPlayerList.push(player);
      }
    }
    return livingPlayerList;
  }

  private processDayEnd(
    dayNumber: number,
    sessionLength: number,
    livingPlayerList: Player[],
    votesRequired: number,
  ): void {
    this.activateEmitter();
    if (this.gameHasEnded) return;

    this.applyDayVoteOutcome(
      dayNumber,
      this.resolveDayVoteOutcome(livingPlayerList, votesRequired),
    );
    this.prepareForNight(dayNumber);

    if (dayNumber >= MAX_GAME_DAYS) {
      this.endGame({ outcome: GameOutcome.Draw });
      return;
    }

    const winningFaction = this.findWinningFaction();
    if (winningFaction !== null) {
      this.endGame({
        outcome: GameOutcome.Faction,
        factionName: winningFaction,
      });
    } else {
      this.startNightSession(dayNumber, sessionLength * 0.85);
    }
  }

  private resolveDayVoteOutcome(
    livingPlayerList: Player[],
    votesRequired: number,
  ): DayVoteOutcome {
    if (this.confesserVotedOut) {
      return { kind: "no-elimination" };
    }
    return resolveDayVote(livingPlayerList, votesRequired);
  }

  private applyDayVoteOutcome(
    dayNumber: number,
    outcome: DayVoteOutcome | void,
  ): void {
    if (!outcome || outcome.kind !== "eliminated") {
      return;
    }

    this.endDay = dayNumber + DRAW_TRIGGER_DAYS;
    this.handlePlayerVotedOut(outcome.player);
  }

  private handlePlayerVotedOut(player: Player): void {
    this.systems?.victory.handlePlayerVotedOut(player);

    this.messenger.emitToPlayer(player, ServerEvent.ReceiveMessage, {
      key: MessageKey.YouHaveBeenVotedOut,
    });
    this.messenger.emitToPlayer(player, ServerEvent.BlockMessages);
    player.isAlive = false;
    this.recordTimeline(
      `${player.username} was voted out (${player.role.name}).`,
    );
    this.messenger.emitToRoom(ServerEvent.UpdatePlayerRole, {
      name: player.username,
      role: player.role.name,
    });
  }

  private prepareForNight(dayNumber: number): void {
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.NightNStarted,
      params: { dayNumber },
    });

    for (const player of this.playerList) {
      if (player.isAlive) {
        player.role.dayVisit();
        player.role.dayTappedBy = null;
        player.hasVoted = false;
      }
    }
  }

  startNightSession(nightNumber: number, sessionLength: number) {
    this.activateEmitter();
    if (this.gameHasEnded) return;
    this.phaseVersion++;
    this.time = GamePhase.Night;
    this.dayNumber = nightNumber;
    this.selections.clear();
    this.recordTimeline(`Night ${nightNumber} began.`);
    this.phaseEndsAt = Date.now() + NIGHT_START_DELAY_MS;
    io.to(this.name).emit(ServerEvent.UpdateDayTime, {
      phaseVersion: this.phaseVersion,
      time: DayTime.Night,
      dayNumber: nightNumber,
      timeLeft: NIGHT_TIME_LEFT_SECONDS,
    });

    this.broadcastSnapshots();
    this.phaseScheduler.schedule(NIGHT_START_DELAY_MS, () => {
      this.activateEmitter();
      if (this.gameHasEnded) return;
      this.processNightActions(nightNumber);
      this.checkForWinningFaction(nightNumber, sessionLength);
    });
  }

  private processNightActions(nightNumber: number): void {
    if (this.gameHasEnded) return;
    this.phaseVersion++;
    this.time = GamePhase.Processing;
    this.systems?.factions.resolveNight();
    this.systems?.visits.resolveNight();
    this.systems?.combat.resolveNightCleanup(nightNumber, DRAW_TRIGGER_DAYS);
    for (const player of this.playerList) {
      const action = this.selections.get(player.username);
      if (action?.vote && action.outcome !== "blocked" && !action.visit)
        this.actionFeedback(
          player,
          "Your faction night vote resolved. Check your private results.",
          "resolved",
        );
    }
  }

  private checkForWinningFaction(
    nightNumber: number,
    sessionLength: number,
  ): void {
    if (this.gameHasEnded) return;
    const winningFaction = this.findWinningFaction();
    if (winningFaction !== null) {
      this.endGame({
        outcome: GameOutcome.Faction,
        factionName: winningFaction,
      });
    } else {
      this.startDaySession(nightNumber + 1, sessionLength);
    }
  }

  findWinningFaction(): string | null {
    return determineWinningFaction(this.playerList);
  }

  endGame(result: GameEndResult) {
    this.activateEmitter();
    if (this.gameHasEnded) return;

    this.gameHasEnded = true;
    this.phaseScheduler.cancelAll();
    const winningFactionName =
      result.outcome === GameOutcome.Faction
        ? result.factionName
        : GameOutcome.Draw;

    this.recordTimeline(
      result.outcome === GameOutcome.Draw
        ? "The match ended in a draw."
        : `${winningFactionName} won.`,
    );
    const playerWon = (player: Player) =>
      player.role.victoryCondition ||
      (result.outcome === GameOutcome.Faction &&
        player.role.group === winningFactionName);
    this.recap = {
      winner: winningFactionName,
      reason:
        result.outcome === GameOutcome.Draw
          ? this.dayNumber >= MAX_GAME_DAYS
            ? "The match reached its day limit."
            : "No player died for three consecutive days."
          : winningFactionName === RoleGroup.Neutral
            ? "No Town or Mafia players remain."
            : `The surviving non-neutral players all belong to ${winningFactionName}.`,
      players: this.playerList.map((player) => ({
        name: player.username,
        role: player.role.name,
        won: playerWon(player),
      })),
      timeline: [...this.timeline],
    };
    // Keep the completed match's players in the recap/history, while releasing
    // seats whose reconnect grace expired so a new group can fill the rematch.
    this.userList = this.userList.filter((user) => !user.hasDeparted);
    this.userList.forEach((user, position) => {
      user.socket.data.position = position;
    });
    this.broadcastSnapshots();
    const winningRoles = this.playerList
      .filter(playerWon)
      .map((player) => player.role.name);

    void persistMatchHistory(
      {
        gameId: `${this.name}:${this.startedAt.toISOString()}:${this.round}`,
        roomName: this.name,
        startedAt: this.startedAt,
        endedAt: new Date(),
        winningFaction: winningFactionName,
        winningRoles,
        participants: this.playerList.map((player) => ({
          userId: player.user.userId,
          username: player.username,
          role: player.role.name,
          won: playerWon(player),
        })),
        conversationHistory: this.conversationHistory,
        actionHistory: this.actionHistory,
      },
      this.backend,
    ).catch((error) => {
      console.error("Failed to persist match history", error);
    });

    if (result.outcome === GameOutcome.Draw) {
      this.messenger.emitToRoom(ServerEvent.ReceiveMessage, {
        key: MessageKey.GameEndedDraw,
      });
    } else if (winningFactionName === RoleGroup.Neutral) {
      this.messenger.emitToRoom(ServerEvent.ReceiveMessage, {
        key: MessageKey.NeutralPlayersWon,
      });
    } else {
      this.messenger.emitToRoom(ServerEvent.ReceiveMessage, {
        key: MessageKey.FactionWon,
        params: { factionName: winningFactionName },
      });
    }
    this.messenger.emitToRoom(ServerEvent.BlockMessages);
  }
}
