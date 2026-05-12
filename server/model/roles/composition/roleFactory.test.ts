import { beforeAll, describe, expect, it } from "vitest";
import { RoleFaction } from "@mernmafia/shared/game/rolesTypes";
import { CombatLevel } from "../combatLevel.js";
import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { User } from "../../user/user.js";
import {
  createRoleInstance,
  type CustomRoleDefinition,
  validateCustomRoleDefinition,
} from "./roleFactory.js";
import { setGameEmitter } from "../../../servers/emitter.js";

function createSocket(id: string) {
  return {
    id,
    data: {},
    join: () => {},
  };
}

function createPlayer(name: string): Player {
  return new Player(new User(createSocket(`${name}-socket`), name));
}

beforeAll(() => {
  setGameEmitter({
    to: () => ({ emit: () => {} }),
    in: () => ({ disconnectSockets: () => {} }),
  });
});

describe("custom role composition", () => {
  it("instantiates custom roles through the same role factory path", () => {
    const customDefinition: CustomRoleDefinition = {
      kind: "custom",
      metadata: {
        name: "Custom Hunter",
        faction: RoleFaction.Town,
        category: "town-killing",
        summary: "Custom attack role.",
        description: "Attacks a chosen target at night.",
        capabilities: {
          dayVisitSelf: false,
          dayVisitOthers: false,
          dayVisitFaction: false,
          nightVisitSelf: false,
          nightVisitOthers: true,
          nightVisitFaction: false,
          nightVote: false,
        },
      },
      behaviors: [{ kind: "night-attack", damage: CombatLevel.Low }],
    };

    const room = new Room(2, "room-custom-role");
    const actorPlayer = createPlayer("actor");
    const targetPlayer = createPlayer("target");
    room.playerList = [actorPlayer, targetPlayer];
    const actor = createRoleInstance(customDefinition, room, actorPlayer);
    const target = createRoleInstance(customDefinition, room, targetPlayer);
    actorPlayer.assignRole(actor);
    targetPlayer.assignRole(target);

    actor.handleNightAction(targetPlayer);
    actor.visit();

    expect(target.damage).toBe(CombatLevel.Low);
  });

  it("returns structured validation issues for unsupported custom-role combinations", () => {
    const invalidDefinition: CustomRoleDefinition = {
      kind: "custom",
      metadata: {
        name: "Broken Role",
        faction: RoleFaction.Town,
        category: "town-support",
        summary: "Invalid custom role.",
        description: "Contains unsupported combinations.",
        capabilities: {
          dayVisitSelf: false,
          dayVisitOthers: false,
          dayVisitFaction: false,
          nightVisitSelf: false,
          nightVisitOthers: false,
          nightVisitFaction: false,
          nightVote: true,
        },
      },
      behaviors: [{ kind: "no-action" }, { kind: "night-attack" }],
    };

    const issues = validateCustomRoleDefinition(invalidDefinition);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "conflicting-behaviors",
          path: "behaviors",
        }),
        expect.objectContaining({
          code: "missing-night-visit-capability",
          path: "metadata.capabilities",
        }),
        expect.objectContaining({
          code: "unsupported-night-vote",
          path: "metadata.capabilities.nightVote",
        }),
      ]),
    );
  });
});
