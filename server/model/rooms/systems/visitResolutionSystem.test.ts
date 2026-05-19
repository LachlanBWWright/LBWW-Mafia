import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { beforeEach, describe, expect, it } from "vitest";
import {
  assignRole,
  captureEmitter,
  createRoomWithPlayers,
  setDeterministicRandom,
  wireGameSystems,
  type EmittedCall,
} from "../../testUtils/gameTestUtils.js";
import { CombatLevel } from "../../roles/combatLevel.js";
import { mafiaDefinition } from "../../roles/definitions/mafia.js";
import { doctorDefinition, roleblockerDefinition } from "../../roles/definitions/town.js";
import { VisitResolutionSystem } from "./visitResolutionSystem.js";

let emittedCalls: EmittedCall[];

beforeEach(() => {
  emittedCalls = captureEmitter();
});

describe("VisitResolutionSystem", () => {
  it("roleblocks a target before that target can resolve its visit", () => {
    const { room, players } = createRoomWithPlayers("visit-roleblock", [
      "blocker",
      "doctor",
      "target",
    ]);
    const blocker = assignRole(room, players[0]!, roleblockerDefinition);
    const doctor = assignRole(room, players[1]!, doctorDefinition);
    const target = assignRole(room, players[2]!, doctorDefinition);
    blocker.handleNightAction(players[1]!);
    doctor.handleNightAction(players[2]!);

    new VisitResolutionSystem(room).resolveNight();

    expect(target.defence).toBe(CombatLevel.None);
    expect(doctor.visiting).toBeNull();
    expect(doctor.roleblocked).toBe(false);
    expect(
      emittedCalls.some(
        (call) =>
          call.target === players[1]!.user.socketId &&
          call.event === ServerEvent.ReceiveMessage &&
          (call.args[0] as { key?: MessageKey }).key === MessageKey.YouWereRoleblocked,
      ),
    ).toBe(true);
  });

  it("applies faction night intents once and drains them", () => {
    const { room, players } = createRoomWithPlayers("visit-faction-intent", [
      "mafia",
      "victim",
    ]);
    const mafia = assignRole(room, players[0]!, mafiaDefinition);
    const victim = assignRole(room, players[1]!, doctorDefinition);
    wireGameSystems(room);
    setDeterministicRandom(room, [0]);

    mafia.handleNightVote(players[1]!);
    room.systems!.factions.resolveNight();
    new VisitResolutionSystem(room).resolveNight();

    expect(victim.damage).toBe(CombatLevel.Low);
    expect(victim.attackers).toEqual([mafia]);
    expect(room.factionList[0]!.drainNightIntents()).toEqual([]);
  });

  it("ignores faction intents with dead actors or dead targets", () => {
    const { room, players } = createRoomWithPlayers("visit-dead-intent", [
      "mafia",
      "victim",
    ]);
    const mafia = assignRole(room, players[0]!, mafiaDefinition);
    const victim = assignRole(room, players[1]!, doctorDefinition);
    wireGameSystems(room);
    setDeterministicRandom(room, [0]);

    mafia.handleNightVote(players[1]!);
    room.systems!.factions.resolveNight();
    players[1]!.isAlive = false;
    new VisitResolutionSystem(room).resolveNight();

    expect(victim.damage).toBe(CombatLevel.None);
    expect(victim.attackers).toEqual([]);
  });
});
