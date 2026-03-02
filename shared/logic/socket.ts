/**
 * Shared socket event registration utility.
 *
 * Provides a single `registerGameSocketEvents()` function that wires all
 * server → client game events using the `ServerEvent` enum — no raw string
 * literals. Consumers (Next.js lobby hook, mobile GameScreen) call this once
 * and receive a cleanup function to deregister all handlers.
 *
 * Single-Responsibility: this module owns event wiring only.
 * Open/Closed: add new callbacks to `GameEventCallbacks` without touching consumers.
 * Liskov / Interface Segregation: consumers implement only the callbacks they need.
 * Dependency Inversion: depends on `GameSocket` abstraction, not Socket.IO or PartyKit directly.
 */
import { ServerEvent } from "../communication/events";
import type { GameSocket } from "../communication/clientTypes";
import type { PlayerList, PlayerReturned } from "../communication/events";
import type { DayTime } from "../game/playerActionRules";

/** All server → client game event callbacks. */
export interface GameEventCallbacks {
  /** Plain system message (e.g. "You were roleblocked!"). */
  onSystemMessage: (text: string) => void;
  /** Public chat message visible to the whole room. */
  onChatMessage: (text: string) => void;
  /** Whisper visible only to the sender and recipient. */
  onWhisperMessage: (text: string) => void;
  /** Full snapshot of the player list (sent on join or after game start). */
  onPlayerList: (list: PlayerList[]) => void;
  /** A new player has joined the lobby. */
  onNewPlayer: (player: { name: string }) => void;
  /** A player has left the lobby. */
  onRemovePlayer: (player: { name: string }) => void;
  /** The local user's own role has been assigned (game start). */
  onAssignRole: (data: PlayerReturned) => void;
  /** A faction ally's role has been revealed. */
  onFactionRole: (data: { name: string; role: string }) => void;
  /** A player has died; their role is now public. */
  onUpdateRole: (data: { name: string; role?: string }) => void;
  /** Day/night phase has changed. */
  onDayTime: (data: { time: DayTime; dayNumber: number; timeLeft: number }) => void;
  /** Day voting has been permanently disabled (e.g. Confesser voted out). */
  onDisableVoting: () => void;
  /** The local user can no longer send messages. */
  onBlockMessages: () => void;
}

/**
 * Registers all game socket event handlers and returns a cleanup function
 * that removes every handler registered here.
 *
 * Usage:
 * ```ts
 * const cleanup = registerGameSocketEvents(socket, callbacks);
 * // later, on unmount:
 * cleanup();
 * socket.disconnect();
 * ```
 */
export function registerGameSocketEvents(
  socket: GameSocket,
  callbacks: GameEventCallbacks,
): () => void {
  socket.on(ServerEvent.ReceiveMessage, callbacks.onSystemMessage);
  socket.on(ServerEvent.ReceiveChatMessage, callbacks.onChatMessage);
  socket.on(ServerEvent.ReceiveWhisperMessage, callbacks.onWhisperMessage);
  socket.on(ServerEvent.ReceivePlayerList, callbacks.onPlayerList);
  socket.on(ServerEvent.ReceiveNewPlayer, callbacks.onNewPlayer);
  socket.on(ServerEvent.RemovePlayer, callbacks.onRemovePlayer);
  socket.on(ServerEvent.AssignPlayerRole, callbacks.onAssignRole);
  socket.on(ServerEvent.UpdateFactionRole, callbacks.onFactionRole);
  socket.on(ServerEvent.UpdatePlayerRole, callbacks.onUpdateRole);
  socket.on(ServerEvent.UpdateDayTime, callbacks.onDayTime);
  socket.on(ServerEvent.DisableVoting, callbacks.onDisableVoting);
  socket.on(ServerEvent.BlockMessages, callbacks.onBlockMessages);
  // UpdatePlayerVisit carries no data; register a no-op so the protocol stays complete.
  socket.on(ServerEvent.UpdatePlayerVisit, () => undefined);

  return () => {
    socket.off(ServerEvent.ReceiveMessage, callbacks.onSystemMessage);
    socket.off(ServerEvent.ReceiveChatMessage, callbacks.onChatMessage);
    socket.off(ServerEvent.ReceiveWhisperMessage, callbacks.onWhisperMessage);
    socket.off(ServerEvent.ReceivePlayerList, callbacks.onPlayerList);
    socket.off(ServerEvent.ReceiveNewPlayer, callbacks.onNewPlayer);
    socket.off(ServerEvent.RemovePlayer, callbacks.onRemovePlayer);
    socket.off(ServerEvent.AssignPlayerRole, callbacks.onAssignRole);
    socket.off(ServerEvent.UpdateFactionRole, callbacks.onFactionRole);
    socket.off(ServerEvent.UpdatePlayerRole, callbacks.onUpdateRole);
    socket.off(ServerEvent.UpdateDayTime, callbacks.onDayTime);
    socket.off(ServerEvent.DisableVoting, callbacks.onDisableVoting);
    socket.off(ServerEvent.BlockMessages, callbacks.onBlockMessages);
    socket.off(ServerEvent.UpdatePlayerVisit);
  };
}
