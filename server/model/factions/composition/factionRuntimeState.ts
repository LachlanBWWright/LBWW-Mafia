import type { GameRole } from "../../roles/roleContracts.js";
import type { FactionNightActionIntent } from "../nightIntent.js";

export type FactionRuntimeState = {
  votes: Map<string, GameRole>;
  intents: FactionNightActionIntent[];
};

/**
 * Creates empty runtime state for a composed faction.
 *
 * @returns Empty faction runtime state.
 */
export function createFactionRuntimeState(): FactionRuntimeState {
  return {
    votes: new Map(),
    intents: [],
  };
}
