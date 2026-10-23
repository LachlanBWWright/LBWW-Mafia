import {
  ServerEvent,
  type GameSnapshot,
} from "@mernmafia/shared/communication/events";
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
import {
  doctorDefinition,
  investigatorDefinition,
  roleblockerDefinition,
} from "../../roles/definitions/town.js";
import { VisitResolutionSystem } from "./visitResolutionSystem.js";

let emittedCalls: EmittedCall[];

beforeEach(() => {
  emittedCalls = captureEmitter();
});

describe("VisitResolutionSystem", () => {
  function latestAction(socketId: string) {
    return (
      emittedCalls
        .filter(
          (call) =>
            call.target === socketId && call.event === ServerEvent.GameSnapshot,
        )
        .at(-1)?.args[0] as GameSnapshot | undefined
    )?.action;
  }

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
          (call.args[0] as { key?: MessageKey }).key ===
            MessageKey.YouWereRoleblocked,
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

  it("does not let a blocked roleblocker act during the early resolution stage", () => {
    const { room, players } = createRoomWithPlayers("visit-blocked-blocker", [
      "blocker",
      "doctor",
    ]);
    const blocker = assignRole(room, players[0]!, roleblockerDefinition);
    const doctor = assignRole(room, players[1]!, doctorDefinition);
    blocker.handleNightAction(players[1]!);
    blocker.roleblocked = true;

    new VisitResolutionSystem(room).resolveNight();

    expect(doctor.roleblocking).toBeNull();
    expect(latestAction(players[0]!.user.socketId)?.outcome).toBe("blocked");
  });

  it("gives the same silent feedback whether a probabilistic block took effect or failed", () => {
    const { room, players } = createRoomWithPlayers("visit-private-block", [
      "blocker",
      "mafia",
    ]);
    const blocker = assignRole(room, players[0]!, roleblockerDefinition);
    const mafia = assignRole(room, players[1]!, mafiaDefinition);
    blocker.handleNightAction(players[1]!);
    setDeterministicRandom(room, [0]);
    new VisitResolutionSystem(room).resolveNight();
    const failed = latestAction(players[0]!.user.socketId);
    expect(mafia.roleblocking).toBeNull();

    blocker.handleNightAction(players[1]!);
    setDeterministicRandom(room, [1]);
    new VisitResolutionSystem(room).resolveNight();
    expect(mafia.roleblocking).toBe(blocker);
    expect(latestAction(players[0]!.user.socketId)).toEqual(failed);
    expect(failed?.feedback).toContain("No additional result");
  });

  it("points only the investigator to their existing private result", () => {
    const { room, players } = createRoomWithPlayers("visit-private-feedback", [
      "investigator",
      "doctor",
      "target",
    ]);
    const investigator = assignRole(room, players[0]!, investigatorDefinition);
    const doctor = assignRole(room, players[1]!, doctorDefinition);
    assignRole(room, players[2]!, doctorDefinition);
    investigator.handleNightAction(players[2]!);
    doctor.handleNightAction(players[2]!);

    new VisitResolutionSystem(room).resolveNight();

    expect(latestAction(players[0]!.user.socketId)?.feedback).toContain(
      "private result is available",
    );
    expect(latestAction(players[1]!.user.socketId)?.feedback).toContain(
      "No additional result",
    );
    expect(latestAction(players[2]!.user.socketId)).toBeUndefined();
  });

  it("does not apply a dead actor's previously selected visit", () => {
    const { room, players } = createRoomWithPlayers("visit-dead-actor", [
      "doctor",
      "target",
    ]);
    const doctor = assignRole(room, players[0]!, doctorDefinition);
    const target = assignRole(room, players[1]!, doctorDefinition);
    doctor.handleNightAction(players[1]!);
    players[0]!.isAlive = false;

    new VisitResolutionSystem(room).resolveNight();

    expect(target.defence).toBe(CombatLevel.None);
  });
});
