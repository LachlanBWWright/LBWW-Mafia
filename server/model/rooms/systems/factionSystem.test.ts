import { describe, expect, it } from "vitest";
import {
  assignRole,
  createRoomWithPlayers,
  installNoopEmitter,
  setDeterministicRandom,
  wireGameSystems,
} from "../../testUtils/gameTestUtils.js";
import { mafiaDefinition } from "../../roles/definitions/mafia.js";
import { doctorDefinition } from "../../roles/definitions/town.js";
import { FactionSystem } from "./factionSystem.js";

describe("FactionSystem", () => {
  it("removes dead members before resolving night votes", () => {
    installNoopEmitter();
    const { room, players } = createRoomWithPlayers("faction-cleanup", [
      "mafia-a",
      "mafia-b",
      "victim",
    ]);
    const mafiaA = assignRole(room, players[0]!, mafiaDefinition);
    assignRole(room, players[1]!, mafiaDefinition);
    assignRole(room, players[2]!, doctorDefinition);
    wireGameSystems(room);
    players[1]!.isAlive = false;
    setDeterministicRandom(room, [0]);

    mafiaA.handleNightVote(players[2]!);
    new FactionSystem(room).resolveNight();

    expect(room.factionList[0]!.memberList).toEqual([players[0]]);
    expect(room.factionList[0]!.drainNightIntents()[0]?.actor).toBe(mafiaA);
  });

  it("clears stored night votes after resolving faction intents", () => {
    installNoopEmitter();
    const { room, players } = createRoomWithPlayers("faction-votes", [
      "mafia",
      "victim",
    ]);
    const mafia = assignRole(room, players[0]!, mafiaDefinition);
    const victim = assignRole(room, players[1]!, doctorDefinition);
    wireGameSystems(room);
    setDeterministicRandom(room, [0]);

    mafia.handleNightVote(players[1]!);
    new FactionSystem(room).resolveNight();

    expect(room.factionList[0]!.readNightVotes()).toEqual([]);
    expect(room.factionList[0]!.drainNightIntents()[0]?.target).toBe(victim);
  });
});
