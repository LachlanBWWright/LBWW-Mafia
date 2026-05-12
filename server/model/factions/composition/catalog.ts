import { lawmanFactionDefinition } from "../definitions/lawman.js";
import { mafiaFactionDefinition } from "../definitions/mafia.js";
import type { FactionDefinition } from "./factionDefinition.js";

export const builtInFactionDefinitions: FactionDefinition[] = [
  mafiaFactionDefinition,
  lawmanFactionDefinition,
];
