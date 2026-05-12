import type { Role } from "../../roles/abstractRole.js";
import type { FactionNightActionIntent } from "../nightIntent.js";

export type FactionRuntimeState = {
  votes: Map<string, Role>;
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
