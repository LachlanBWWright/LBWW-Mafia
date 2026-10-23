import type { GameSocket } from "../communication/clientTypes";
import { MessageKey } from "../communication/messages";
import {
  ClientEvent,
  DayTime,
  ServerEvent,
  type ClientToServerEvents,
  type GameSnapshot,
  type ServerToClientEvents,
} from "../communication/events";

/** A deterministic, local match: no account, server, or paid model is needed. */
export class PracticeSocket implements GameSocket {
  readonly id = "practice";
  connected = false;
  private listeners = new Map<keyof ServerToClientEvents, Set<unknown>>();
  private matchNumber = 0;
  private phaseVersion = 0;
  private snapshot: GameSnapshot = this.initial();
  private initial(): GameSnapshot {
    return {
      matchId: `practice-${++this.matchNumber}`,
      playerName: "You",
      started: true,
      ended: false,
      phaseVersion: ++this.phaseVersion,
      players: [
        { name: "You", role: "Doctor", isAlive: true, connected: true },
        { name: "Mira", isAlive: true, connected: true, isBot: true },
        { name: "Theo", isAlive: true, connected: true, isBot: true },
      ],
      role: {
        name: "You",
        role: "Doctor",
        dayVisitSelf: false,
        dayVisitOthers: false,
        dayVisitFaction: false,
        nightVisitSelf: false,
        nightVisitOthers: true,
        nightVisitFaction: true,
        nightVote: false,
      },
      time: DayTime.Night,
      dayNumber: 1,
      timeLeft: 0,
      canTalk: false,
      canVote: false,
      action: {},
      timeline: [
        { id: 1, day: 1, phase: DayTime.Night, text: "Night 1 began." },
      ],
      voteVisibility: "public",
    };
  }
  on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K],
  ) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
  }
  off<K extends keyof ServerToClientEvents>(
    event: K,
    handler?: ServerToClientEvents[K],
  ) {
    if (handler) this.listeners.get(event)?.delete(handler);
    else this.listeners.delete(event);
  }
  private publish<K extends keyof ServerToClientEvents>(
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ) {
    for (const handler of this.listeners.get(event) ?? [])
      (handler as (...values: Parameters<ServerToClientEvents[K]>) => void)(
        ...args,
      );
  }
  connect(onOpen?: () => void) {
    this.connected = true;
    onOpen?.();
  }
  disconnect() {
    this.connected = false;
  }
  advance() {
    if (!this.connected) return;
    if (this.snapshot.time === DayTime.Night && this.snapshot.action?.visit) {
      const target = this.snapshot.action.visit;
      this.snapshot = {
        ...this.snapshot,
        time: DayTime.Day,
        dayNumber: 2,
        phaseVersion: ++this.phaseVersion,
        canVote: true,
        canTalk: true,
        action: {
          feedback: `Your protection resolved. ${target} survived the night.`,
          outcome: "resolved",
        },
        timeline: [
          ...this.snapshot.timeline!,
          {
            id: 2,
            day: 2,
            phase: DayTime.Day,
            text: "Day 2 began. Everyone survived the night.",
          },
        ],
      };
      this.publish(
        ServerEvent.ReceiveChatMessage,
        "Mira: I saw Theo near my house. Let's compare what we know.",
      );
    }
    this.publish(ServerEvent.GameSnapshot, { ...this.snapshot });
  }
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ) {
    if (!this.connected) return;
    if (
      (event === ClientEvent.HandleVisit || event === ClientEvent.HandleVote) &&
      (args[1] !== this.snapshot.time ||
        (args[0] !== null &&
          (typeof args[0] !== "number" ||
            args[0] === 0 ||
            !this.snapshot.players[args[0]]?.isAlive)))
    ) {
      this.publish(ServerEvent.ReceiveMessage, {
        key: MessageKey.InvalidChoice,
      });
      return;
    }
    if (event === ClientEvent.PlayerJoinRoom) {
      const callback = args.at(-1);
      if (typeof callback === "function")
        callback({ status: "joined", username: "You" });
    }
    if (
      event === ClientEvent.HandleVisit &&
      this.snapshot.time === DayTime.Night &&
      !this.snapshot.ended
    ) {
      const index = args[0];
      const target =
        typeof index === "number" ? this.snapshot.players[index]?.name : null;
      this.snapshot.action = {
        visit: target,
        feedback: target
          ? `Protection selected: ${target}.`
          : "Night action cancelled.",
        outcome: "submitted",
      };
    }
    if (event === ClientEvent.MessageSentByUser && !this.snapshot.ended) {
      this.publish(ServerEvent.ReceiveChatMessage, `You: ${String(args[0])}`);
    }
    if (
      event === ClientEvent.HandleVote &&
      this.snapshot.time === DayTime.Day &&
      !this.snapshot.ended
    ) {
      const target =
        typeof args[0] === "number"
          ? this.snapshot.players[args[0]]?.name
          : null;
      const votedOut = target === "Theo";
      this.snapshot = {
        ...this.snapshot,
        ended: true,
        canTalk: false,
        canVote: false,
        action: {
          vote: target,
          feedback: target ? `Vote submitted for ${target}.` : "You abstained.",
          outcome: "submitted",
        },
        players: this.snapshot.players.map((player) => ({
          ...player,
          role:
            player.name === "Theo"
              ? "Mafia"
              : player.name === "Mira"
                ? "Investigator"
                : "Doctor",
        })),
        recap: {
          winner: votedOut ? "Town" : "draw",
          reason: votedOut
            ? "Theo was the Mafia player. Your vote helped the Town win."
            : "Practice complete. Theo was the Mafia player; compare Mira's clue with your next vote.",
          players: [
            { name: "You", role: "Doctor", won: votedOut },
            { name: "Mira", role: "Investigator", won: votedOut },
            { name: "Theo", role: "Mafia", won: false },
          ],
          timeline: [
            ...this.snapshot.timeline!,
            {
              id: 3,
              day: 2,
              phase: DayTime.Day,
              text: target ? `You voted for ${target}.` : "You abstained.",
            },
          ],
        },
      };
    }
    if (event === ClientEvent.ReadyForRematch && this.snapshot.ended)
      this.snapshot = this.initial();
    this.publish(ServerEvent.GameSnapshot, { ...this.snapshot });
  }
}
