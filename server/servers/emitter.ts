/**
 * Mutable GameEmitter singleton.
 * The chosen backend (Socket.IO or PartyKit) sets the emitter before game logic runs.
 * All game logic imports `io` from this module, which delegates to the active emitter.
 */
import type { GameEmitter } from "../../shared/communication/serverTypes.js";
import { ok, err, Result } from "neverthrow";

let _emitter: GameEmitter | null = null;

export function setGameEmitter(emitter: GameEmitter): void {
  _emitter = emitter;
}

export function getGameEmitter(): Result<GameEmitter, Error> {
  if (!_emitter) {
    return err(
      new Error(
        "GameEmitter not initialized. Call setGameEmitter() from the backend entry point first.",
      ),
    );
  }
  return ok(_emitter);
}

/**
 * Delegating GameEmitter proxy.
 * Import `io` from this module in game logic (Room, Role, Faction) to stay
 * backend-agnostic. Avoids pulling Socket.IO into the PartyKit bundle.
 */
export const io: GameEmitter = {
  to(target: string) {
    const res = getGameEmitter();
    if (res.isErr()) {
      console.warn(res.error);
      return { emit: () => {} };
    }
    return res.value.to(target);
  },
  in(target: string) {
    const res = getGameEmitter();
    if (res.isErr()) {
      console.warn(res.error);
      return { disconnectSockets: () => {} };
    }
    return res.value.in(target);
  },
};
