import type { GameFaction as ImportedGameFaction } from "./factionContracts.js";
import { initializeFactionMembers as importedInitializeFactionMembers } from "./factionContracts.js";
export type GameFaction = ImportedGameFaction;
export const initializeFactionMembers = importedInitializeFactionMembers;
