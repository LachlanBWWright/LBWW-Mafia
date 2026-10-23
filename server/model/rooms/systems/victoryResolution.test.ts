import { describe, expect, it } from "vitest";
import {
  assignRole,
  createRoomWithPlayers,
  installNoopEmitter,
} from "../../testUtils/gameTestUtils.js";
import { doctorDefinition } from "../../roles/definitions/town.js";
import { mafiaDefinition } from "../../roles/definitions/mafia.js";
import { framerDefinition } from "../../roles/definitions/neutral.js";
import { determineWinningFaction } from "./victoryResolution.js";

describe("determineWinningFaction", () => {
  it("returns null while living non-neutral factions conflict", () => {
    installNoopEmitter();
    const { room, players } = createRoomWithPlayers("victory-conflict", [
      "town",
      "mafia",
      "neutral",
    ]);
    assignRole(room, players[0]!, doctorDefinition);
    assignRole(room, players[1]!, mafiaDefinition);
    assignRole(room, players[2]!, framerDefinition);

    expect(determineWinningFaction(players)).toBeNull();
  });

  it("returns the surviving non-neutral faction when only one remains", () => {
    installNoopEmitter();
    const { room, players } = createRoomWithPlayers("victory-faction", [
      "town",
      "mafia",
      "neutral",
    ]);
    assignRole(room, players[0]!, doctorDefinition);
    assignRole(room, players[1]!, mafiaDefinition);
    assignRole(room, players[2]!, framerDefinition);
    players[1]!.isAlive = false;

    expect(determineWinningFaction(players)).toBe(players[0]!.role.group);
  });

  it("returns neutral when no living non-neutral faction remains", () => {
    installNoopEmitter();
    const { room, players } = createRoomWithPlayers("victory-neutral", [
      "town",
      "neutral",
    ]);
    assignRole(room, players[0]!, doctorDefinition);
    assignRole(room, players[1]!, framerDefinition);
    players[0]!.isAlive = false;

    expect(determineWinningFaction(players)).toBe(players[1]!.role.group);
  });
});
