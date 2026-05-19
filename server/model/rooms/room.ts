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
import { io } from "../../servers/emitter.js";
import type { GameFaction } from "../factions/factionContracts.js";
import { RoleGroup } from "../roles/roleGroup.js";
import { CombatLevel } from "../roles/combatLevel.js";
import { clientPhaseMatchesRoomPhase, GamePhase } from "./gamePhase.js";
import { names } from "../player/names/namesList.js";
import { GameSystems } from "./systems/gameSystems.js";
import { RoomMessenger } from "./roomMessenger.js";
import { PhaseScheduler } from "./systems/phaseScheduler.js";
import {
  resolveDayVote,
  type DayVoteOutcome,
} from "./systems/voteSystem.js";
import { determineWinningFaction } from "./systems/victoryResolution.js";
import {
  persistMatchHistory,
  rotateActiveRoom,
  type MatchHistoryEvent,
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
  private randomSource: () => number = Math.random;
  private readonly phaseScheduler = new PhaseScheduler(() => this.gameHasEnded);

  /** Users connected in the lobby (before the game starts). */
  userList: User[] = [];
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

  startedAt = new Date();
  conversationHistory: MatchHistoryEvent[] = [];
  actionHistory: MatchHistoryEvent[] = [];

  constructor(size: number, name?: string) {
    this.name = name ?? createRoomName();
    this.size = size;
    this.sessionLength = this.size * SESSION_LENGTH_PER_PLAYER_MS;
    this.messenger = new RoomMessenger(this.name);
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

  private recordConversation(
    content: string,
    actor?: string,
    target?: string,
    type: MatchHistoryEvent["type"] = "chat",
  ) {
    this.conversationHistory.push({
      time: Date.now(),
      type,
      actor,
      target,
      content,
    });
  }

  private recordAction(content: ActionKind, actor?: string, target?: string) {
    this.actionHistory.push({
      time: Date.now(),
      type: "action",
      actor,
      target,
      content,
    });
  }

  /** Returns the active Player for a given socket, or null if not found. */
  private getPlayerFromSocket(socket: GamePlayerSocket): Player | null {
    const position = socket.data.position;
    if (typeof position !== "number") return null;
    const user = this.getUserAt(position);
    if (!user) return null;
    return this.playerList.find((p) => p.user === user) ?? null;
  }

  private getUserAt(index: number): User | null {
    return this.userList[index] ?? null;
  }

  private getUserFromSocket(socket: GamePlayerSocket): User | null {
    const position = socket.data.position;
    if (typeof position !== "number") return null;
    return this.getUserAt(position);
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
  addUser(playerSocket: GamePlayerSocket): JoinRoomResult {
    const socketId = playerSocket.id;
    if (this.userList.some((u) => u.socketId === socketId))
      return { status: "rejected", code: JoinRoomResultCode.GenericError };
    if (this.userList.length >= this.size) {
      void rotateActiveRoom().catch((error) => {
        console.error("Failed to rotate active room", error);
      });
      return { status: "rejected", code: JoinRoomResultCode.RoomFull };
    }

    const takenNames = this.userList.map((u) => u.username);
    const username = names.find((n) => !takenNames.includes(n));
    if (!username) {
      return { status: "rejected", code: JoinRoomResultCode.GenericError };
    }

    const user = new User(playerSocket, username);
    const position = this.userList.push(user) - 1;
    playerSocket.data.position = position;

    this.emitUserList(socketId);
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.PlayerJoinedRoom,
      params: { playerName: username },
    });
    this.recordConversation(`${username} has joined the room!`, username);
    io.to(this.name).emit(ServerEvent.ReceiveNewPlayer, { name: username });

    if (this.userList.length === this.size) {
      this.started = true;
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.RoomFullStartingGame,
      });
      this.emitUserList(this.name);
      void rotateActiveRoom().catch((error) => {
        console.error("Failed to rotate active room", error);
      });
      this.startGame();
    }

    return { status: "joined", username };
  }

  /** Handles a connected user leaving (pre-game removal or in-game death by abandonment). */
  removePlayer(socketId: string) {
    if (this.gameHasEnded) return;

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
      io.to(this.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.PlayerAbandonedGame,
        params: { playerName: player.username },
      });
      player.role.damage = CombatLevel.Fatal;
    }
  }

  emitUserList(target: string) {
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
    this.recordConversation(message, player.username);
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
    recipient: number,
    phase: DayTime,
  ) {
    if (!this.started || this.isActionInWrongPhase(phase)) return;

    const foundPlayer = this.getPlayerFromSocket(playerSocket);
    const foundRecipient = this.getPlayerAt(recipient);
    if (!foundPlayer || !foundRecipient) return;

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
      this.systems?.roleCommands.runNightVote(foundPlayer, foundRecipient);
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

    this.recordAction(ActionKind.Vote, foundPlayer.username, foundRecipient.username);
    foundPlayer.hasVoted = true;
    foundRecipient.votesReceived++;
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
    io.to(this.name).emit(ServerEvent.ReceiveMessage, voteMsg);
  }

  handleWhisper(
    playerSocket: GamePlayerSocket,
    recipient: number,
    message: string,
    phase: DayTime,
  ) {
    if (!this.started || this.isActionInWrongPhase(phase)) return;

    const foundPlayer = this.getPlayerFromSocket(playerSocket);
    const foundRecipient = this.getPlayerAt(recipient);
    if (!foundPlayer || !foundRecipient) return;

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
    if (!this.started || this.isActionInWrongPhase(phase)) return;

    const foundPlayer = this.getPlayerFromSocket(playerSocket);
    const foundRecipient = recipient !== null ? this.getPlayerAt(recipient) : null;
    if (!foundPlayer) return;

    if (this.time === GamePhase.Day) {
      this.handleDayVisit(foundPlayer, foundRecipient);
    } else if (this.time === GamePhase.Night) {
      this.handleNightVisit(foundPlayer, playerSocket, foundRecipient);
    }
  }

  private handleDayVisit(foundPlayer: Player, foundRecipient: Player | null) {
    if (foundRecipient === null) {
      foundPlayer.role.cancelDayAction();
      return;
    }

    this.recordAction(
      ActionKind.DayVisit,
      foundPlayer.username,
      foundRecipient.username,
    );
    foundPlayer.role.handleDayAction(foundRecipient);
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
      return;
    }

    if (foundRecipient === null) {
      foundPlayer.role.cancelNightAction();
      return;
    }

    this.recordAction(
      ActionKind.NightVisit,
      foundPlayer.username,
      foundRecipient.username,
    );
    foundPlayer.role.handleNightAction(foundRecipient);
  }

  async startGame() {
    if (this.gameHasEnded) return;

    const roleHandler = new RoleHandler(
      this.userList.length,
      [],
      () => this.random(),
    );
    this.roleList.push(...roleHandler.assignGame());

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

    this.factionList.push(...roleHandler.assignFactionsFromPlayerList(this.playerList, this));
    for (const faction of this.factionList)
      faction.findMembers(this.playerList);
    for (const player of this.playerList) player.role.initRole();
    this.systems = new GameSystems(this);

    this.startFirstDaySession(this.sessionLength);
  }

  startFirstDaySession(sessionLength: number) {
    if (this.gameHasEnded) return;
    this.time = GamePhase.Day;
    io.to(this.name).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.Day1Started,
    });
    io.to(this.name).emit(ServerEvent.UpdateDayTime, {
      time: DayTime.Day,
      dayNumber: 1,
      timeLeft: DAY_START_TIME_LEFT_SECONDS,
    });
    this.phaseScheduler.schedule(DAY_START_DELAY_MS, () => {
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
    if (this.gameHasEnded) return;
    this.time = GamePhase.Day;

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

    this.phaseScheduler.schedule(
      sessionLength + DAY_END_EXTRA_SECONDS * 1000,
      () => this.processDayEnd(dayNumber, sessionLength, livingPlayerList, votesRequired),
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

  private applyDayVoteOutcome(dayNumber: number, outcome: DayVoteOutcome | void): void {
    if (!outcome || outcome.kind !== "eliminated") {
      return;
    }

    this.endDay = dayNumber + DRAW_TRIGGER_DAYS;
    this.handlePlayerVotedOut(outcome.player);
  }

  private handlePlayerVotedOut(player: Player): void {
    this.systems?.victory.handlePlayerVotedOut(player);

    this.messenger.emitToPlayer(
      player,
      ServerEvent.ReceiveMessage,
      { key: MessageKey.YouHaveBeenVotedOut },
    );
    this.messenger.emitToPlayer(player, ServerEvent.BlockMessages);
    player.isAlive = false;
    this.messenger.emitToRoom(ServerEvent.UpdatePlayerRole, {
      name: player.username,
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
    if (this.gameHasEnded) return;
    this.time = GamePhase.Night;
    io.to(this.name).emit(ServerEvent.UpdateDayTime, {
      time: DayTime.Night,
      dayNumber: nightNumber,
      timeLeft: NIGHT_TIME_LEFT_SECONDS,
    });

    this.phaseScheduler.schedule(NIGHT_START_DELAY_MS, () => {
      if (this.gameHasEnded) return;
      this.processNightActions(nightNumber);
      this.checkForWinningFaction(nightNumber, sessionLength);
    });
  }

  private processNightActions(nightNumber: number): void {
    if (this.gameHasEnded) return;
    this.time = GamePhase.Processing;
    this.systems?.factions.resolveNight();
    this.systems?.visits.resolveNight();
    this.systems?.combat.resolveNightCleanup(nightNumber, DRAW_TRIGGER_DAYS);
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
    if (this.gameHasEnded) return;

    this.gameHasEnded = true;
    this.phaseScheduler.cancelAll();
    const winningFactionName =
      result.outcome === GameOutcome.Faction ? result.factionName : GameOutcome.Draw;

    const winningRoles = this.playerList
      .filter((player) => {
        if (result.outcome === GameOutcome.Draw) return false;
        if (winningFactionName === RoleGroup.Neutral)
          return player.role.group === RoleGroup.Neutral;
        return player.role.group === winningFactionName;
      })
      .map((player) => player.role.name);

    void persistMatchHistory({
      roomName: this.name,
      startedAt: this.startedAt,
      endedAt: new Date(),
      winningFaction: winningFactionName,
      winningRoles,
      participants: this.playerList.map((player) => ({
        username: player.username,
        role: player.role.name,
        won:
          result.outcome === GameOutcome.Draw
            ? false
            : winningFactionName === RoleGroup.Neutral
              ? player.role.group === RoleGroup.Neutral
              : player.role.group === winningFactionName,
      })),
      conversationHistory: this.conversationHistory,
      actionHistory: this.actionHistory,
    }).catch((error) => {
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
    this.messenger.emitToRoom(ServerEvent.ReceiveMessage, {
      key: MessageKey.ClosingRoom,
    });
    this.messenger.emitToRoom(ServerEvent.BlockMessages);
    this.messenger.disconnectRoom();
  }
}
