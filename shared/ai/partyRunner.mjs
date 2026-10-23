import profiles from "../game/botProfiles.json" with { type: "json" };
import { runCharacterTurn } from "./characterDecisions.mjs";

export const CHAT_REACT_DEBOUNCE = 5_000;

export function createBotRunner({
  WebSocket,
  randomUUID,
  generate,
  runTurn = runCharacterTurn,
  report = () => {},
}) {
  let paused = false;
  let activityGeneration = 0;
  const schedulers = new Set();
  class BotSeat {
    constructor({ url, room, captcha, ticket, onSnapshot, onChatMessage }) {
      this.url = `${url.replace(/^http(s?)/, "ws$1").replace(/\/$/, "")}/parties/main/${encodeURIComponent(room)}?resume=${randomUUID()}${randomUUID()}`;
      this.captcha = captcha;
      this.ticket = ticket;
      this.onSnapshot = onSnapshot;
      this.onChatMessage = onChatMessage;
      this.observations = [];
      this.conversation = [];
      this.snapshot = undefined;
      this.phaseVersion = -1;
      this.socket = new WebSocket(this.url);
      this.socket.on("open", () =>
        this.send("playerJoinRoom", [captcha, ticket], "join"),
      );
      this.socket.on("message", (data) => void this.receive(String(data)));
      this.socket.on("error", (error) =>
        report(`Bot connection error: ${error.message}\n`),
      );
      this.socket.on("close", () => {
        this.closed = true;
        this.onSnapshot?.();
        report("A bot seat disconnected.\n");
      });
    }

    send(event, args, callbackId) {
      if (this.socket.readyState !== WebSocket.OPEN) return;
      this.socket.send(
        JSON.stringify({
          type: "event",
          event,
          args,
          ...(callbackId ? { callbackId } : {}),
          ...(event !== "playerJoinRoom"
            ? { commandId: randomUUID(), phaseVersion: this.phaseVersion }
            : {}),
        }),
      );
    }

    emit(event, ...args) {
      if (
        paused ||
        this.closed ||
        this.decisionActivityGeneration !== activityGeneration
      )
        return;
      if (
        this.snapshot?.phaseVersion !== this.decisionVersion ||
        this.snapshot?.matchId !== this.decisionMatchId ||
        this.snapshot?.ended ||
        this.snapshot?.players.find(
          (player) => player.name === this.snapshot.playerName,
        )?.isAlive === false
      )
        return;
      if (event === "handleVote" && this.snapshot?.action?.vote !== undefined)
        return;
      this.send(event, args);
    }

    async receive(raw) {
      let message;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
      if (message.type === "command-ack") {
        if (message.accepted === false)
          report(`Bot action rejected (${message.reason ?? "unknown"}).\n`);
        return;
      }
      if (message.type === "callback") {
        const result = message.args?.[0];
        if (result?.status === "joined")
          report(`Bot joined as ${result.username}.\n`);
        else {
          report(`Bot seat rejected (${result?.code ?? "unknown"}).\n`);
          this.socket.close();
        }
        return;
      }
      if (message.type !== "event") return;
      const [payload] = message.args ?? [];
      if (
        message.event === "game-snapshot" &&
        payload &&
        typeof payload.playerName === "string"
      ) {
        const newMatch =
          this.snapshot?.matchId && payload.matchId !== this.snapshot.matchId;
        if (newMatch) {
          this.conversation = [];
          this.observations = [];
          this.chatVersion = 0;
        }
        this.snapshot = payload;
        if (payload.ended && this.rematchReadyFor !== payload.matchId) {
          this.rematchReadyFor = payload.matchId;
          this.phaseVersion = payload.phaseVersion;
          this.send("readyForRematch", []);
        }
        this.phaseVersion = payload.phaseVersion ?? this.phaseVersion;
        this.onSnapshot?.();
      } else if (
        message.event === "update-day-time" &&
        payload &&
        this.snapshot
      ) {
        this.snapshot = {
          ...this.snapshot,
          time: payload.time,
          dayNumber: payload.dayNumber,
          timeLeft: payload.timeLeft,
          phaseVersion: payload.phaseVersion ?? this.phaseVersion,
        };
        this.phaseVersion = this.snapshot.phaseVersion;
        this.observations.push({ event: message.event, data: payload });
        this.observations = this.observations.slice(-80);
        this.onSnapshot?.();
      } else if (
        message.event === "receive-player-list" &&
        Array.isArray(payload) &&
        this.snapshot
      ) {
        const prior = new Map(
          this.snapshot.players.map((player) => [player.name, player]),
        );
        this.snapshot = {
          ...this.snapshot,
          players: payload.map((player) => ({
            ...prior.get(player.name),
            ...player,
          })),
        };
        this.observations.push({ event: message.event, data: payload });
        this.observations = this.observations.slice(-80);
      } else if (
        message.event === "update-player-role" &&
        payload &&
        this.snapshot
      ) {
        this.snapshot = {
          ...this.snapshot,
          players: this.snapshot.players.map((player) =>
            player.name === payload.name
              ? { ...player, role: payload.role, isAlive: false }
              : player,
          ),
        };
        this.observations.push({ event: message.event, data: payload });
        this.observations = this.observations.slice(-80);
      } else if (
        [
          "receiveMessage",
          "receive-chat-message",
          "receive-whisper-message",
          "update-day-time",
          "assign-player-role",
          "receive-role",
        ].includes(message.event)
      ) {
        this.observations.push({ event: message.event, data: payload });
        this.observations = this.observations.slice(-80);
        if (
          message.event === "receive-chat-message" ||
          message.event === "receive-whisper-message"
        ) {
          this.chatVersion = (this.chatVersion ?? 0) + 1;
          this.onChatMessage?.();
        }
      }
    }

    close() {
      this.socket.close(1000, "Client disconnected");
    }
  }

  function startBotSeats(options) {
    if (!["shared", "per-character"].includes(options.mode))
      throw new Error("Bot mode must be shared or per-character.");
    if (
      options.personality !== undefined &&
      options.personality !== "varied" &&
      !profiles.personalities.some(
        (profile) => profile.id === options.personality,
      )
    )
      throw new Error("Unknown bot personality.");
    if (
      options.difficulty !== undefined &&
      !profiles.difficulties.some(
        (profile) => profile.id === options.difficulty,
      )
    )
      throw new Error("Unknown bot difficulty.");
    const seats = [];
    let stopped = false;
    let sharedConversation = [];
    let inFlight = false;
    let pendingDecision;
    let timer;
    let chatTimer;
    const decide = async ({ chatReady = false } = {}) => {
      if (stopped || paused) return;
      if (inFlight) {
        pendingDecision = {
          chatReady: chatReady || pendingDecision?.chatReady === true,
        };
        return;
      }
      if (seats.some((seat) => !seat.snapshot && !seat.closed)) {
        timer = setTimeout(() => void decide(), 1000);
        return;
      }
      const characters = seats
        .filter(
          (seat) =>
            seat.snapshot &&
            !seat.snapshot.ended &&
            !seat.closed &&
            seat.snapshot.players.find(
              (player) => player.name === seat.snapshot.playerName,
            )?.isAlive !== false,
        )
        .map((seat) => ({
          personality: seat.personality,
          difficulty: seat.difficulty,
          snapshot: seat.snapshot,
          observations: seat.observations,
          conversation: seat.conversation,
          socket: seat,
        }));
      if (!characters.length) return;
      const matchIds = new Set(
        characters.map(({ snapshot }) => snapshot.matchId),
      );
      // Never combine views from two rounds during a staggered rematch transition.
      if (matchIds.size > 1) {
        timer = setTimeout(() => void decide(), 1000);
        return;
      }
      const matchKey = characters[0].snapshot.matchId;
      if (seats.matchKey !== matchKey) {
        sharedConversation = [];
        seats.matchKey = matchKey;
      }
      const phaseKey = characters
        .map(
          ({ snapshot }) =>
            `${snapshot.playerName}:${snapshot.matchId}:${snapshot.phaseVersion}`,
        )
        .join("|");
      const decisionKey = `${phaseKey}|chat:${seats
        .map((seat) => `${seat.snapshot?.playerName}:${seat.chatVersion ?? 0}`)
        .join("|")}`;
      if (!chatReady && chatTimer && seats.lastPhaseKey === phaseKey) return;
      if (seats.lastDecisionKey === decisionKey) return;
      seats.lastDecisionKey = decisionKey;
      seats.lastPhaseKey = phaseKey;
      for (const seat of seats) {
        seat.decisionActivityGeneration = activityGeneration;
        seat.decisionVersion = seat.snapshot?.phaseVersion;
        seat.decisionMatchId = seat.snapshot?.matchId;
      }
      // Retain the bounded player-scoped evidence history for later deductions.
      inFlight = true;
      const decisionGeneration = activityGeneration;
      try {
        await runTurn({
          generate,
          mode: options.mode,
          model: options.model,
          characters,
          sharedConversation,
        });
      } catch (error) {
        report(
          `Bot decision failed: ${error instanceof Error ? error.message : String(error)}\n`,
        );
      } finally {
        if (decisionGeneration !== activityGeneration)
          seats.lastDecisionKey = undefined;
        inFlight = false;
        if (pendingDecision) {
          const pending = pendingDecision;
          pendingDecision = undefined;
          void decide({ chatReady: pending.chatReady && !chatTimer });
        }
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void decide(), 1000);
    };
    const scheduleChatReaction = () => {
      clearTimeout(chatTimer);
      chatTimer = setTimeout(() => {
        chatTimer = undefined;
        void decide({ chatReady: true });
      }, CHAT_REACT_DEBOUNCE);
    };
    for (const [index, ticket] of options.tickets.entries()) {
      seats.push(
        new BotSeat({
          ...options,
          ticket,
          onSnapshot: schedule,
          onChatMessage: scheduleChatReaction,
        }),
      );
      seats.at(-1).personality =
        options.personality === "varied" || !options.personality
          ? profiles.personalities[index % profiles.personalities.length].id
          : options.personality;
      seats.at(-1).difficulty = options.difficulty ?? "standard";
    }
    schedulers.add(schedule);
    seats.stop = () => {
      schedulers.delete(schedule);
      stopped = true;
      clearTimeout(timer);
      clearTimeout(chatTimer);
      pendingDecision = undefined;
      for (const seat of seats) seat.close();
    };
    return seats;
  }

  return {
    startBotSeats,
    setPaused(value) {
      if (paused === value) return;
      activityGeneration += 1;
      paused = value;
      if (!paused) for (const schedule of schedulers) schedule();
    },
  };
}
