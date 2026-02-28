/**
 * Mutable GameEmitter singleton.
 * The chosen backend (Socket.IO or PartyKit) sets the emitter before game logic runs.
 * All game logic imports `io` from socket.ts, which delegates to this emitter.
 */
import type { GameEmitter } from "../../shared/communication/serverTypes.js";

let _emitter: GameEmitter | null = null;

export function setGameEmitter(emitter: GameEmitter): void {
  _emitter = emitter;
}

export function getGameEmitter(): GameEmitter {
  if (!_emitter) {
    throw new Error(
      "GameEmitter not initialized. Call setGameEmitter() from the backend entry point first.",
    );
  }
  return _emitter;
}

/**
 * Delegating GameEmitter proxy.
 * Import `io` from this module in game logic (Room, Role, Faction) to stay
 * backend-agnostic. Avoids pulling Socket.IO into the PartyKit bundle.
 */
export const io: GameEmitter = {
  to(target: string) {
    return getGameEmitter().to(target);
  },
  in(target: string) {
    return getGameEmitter().in(target);
  },
};
