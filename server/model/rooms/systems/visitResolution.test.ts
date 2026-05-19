import { describe, expect, it } from "vitest";
import {
  assignRole,
  createRoomWithPlayers,
  installNoopEmitter,
} from "../../testUtils/gameTestUtils.js";
import { doctorDefinition, roleblockerDefinition } from "../../roles/definitions/town.js";
import { buildVisitResolutionPlan } from "./visitResolution.js";

describe("buildVisitResolutionPlan", () => {
  it("orders roleblockers before normal visitors and post-visit handlers", () => {
    installNoopEmitter();
    const { room, players } = createRoomWithPlayers("visit-plan", [
      "blocker",
      "doctor",
      "dead",
    ]);
    assignRole(room, players[0]!, roleblockerDefinition);
    assignRole(room, players[1]!, doctorDefinition);
    assignRole(room, players[2]!, doctorDefinition);
    players[2]!.isAlive = false;

    expect(buildVisitResolutionPlan(players)).toEqual([
      { stage: "preVisit", player: players[0] },
      { stage: "visit", player: players[1] },
      { stage: "visit", player: players[2] },
      { stage: "postVisit", player: players[0] },
      { stage: "postVisit", player: players[1] },
    ]);
  });
});
