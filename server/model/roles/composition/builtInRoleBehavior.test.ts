import { beforeEach, describe, expect, it } from "vitest";
import {
  assignRole,
  captureEmitter,
  createRoomWithPlayers,
  setDeterministicRandom,
  wireGameSystems,
} from "../../testUtils/gameTestUtils.js";
import { GameSystems } from "../../rooms/systems/gameSystems.js";
import { CombatLevel } from "../combatLevel.js";
import { mafiaDefinition } from "../definitions/mafia.js";
import { framerDefinition } from "../definitions/neutral.js";
import {
  doctorDefinition,
  fortifierDefinition,
  jailorDefinition,
  lawmanDefinition,
  nimbyDefinition,
  roleblockerDefinition,
} from "../definitions/town.js";

beforeEach(() => {
  captureEmitter();
});

describe("built-in role behavior", () => {
  it("doctor rejects self healing and heals a valid night target", () => {
    const { room, players } = createRoomWithPlayers("role-doctor", [
      "doctor",
      "target",
    ]);
    const doctor = assignRole(room, players[0]!, doctorDefinition);
    const target = assignRole(room, players[1]!, doctorDefinition);

    doctor.handleNightAction(players[0]!);
    expect(doctor.visiting).toBeNull();

    doctor.handleNightAction(players[1]!);
    doctor.visit();
    expect(target.defence).toBe(CombatLevel.Low);
  });

  it("mafia stores faction votes and applies a deterministic faction attack", () => {
    const { room, players } = createRoomWithPlayers("role-mafia", [
      "mafia-a",
      "mafia-b",
      "victim",
    ]);
    const mafiaA = assignRole(room, players[0]!, mafiaDefinition);
    assignRole(room, players[1]!, mafiaDefinition);
    const victim = assignRole(room, players[2]!, doctorDefinition);
    wireGameSystems(room);
    setDeterministicRandom(room, [0]);

    mafiaA.handleNightVote(players[2]!);
    expect(room.factionList[0]!.readNightVotes()).toEqual([victim]);
    room.systems!.factions.resolveNight();
    room.systems!.visits.resolveNight();

    expect(victim.damage).toBe(CombatLevel.Low);
    expect(victim.attackers).toEqual([mafiaA]);
  });

  it("roleblocker prevents the selected target from completing a visit", () => {
    const { room, players } = createRoomWithPlayers("role-roleblocker", [
      "blocker",
      "doctor",
      "target",
    ]);
    const blocker = assignRole(room, players[0]!, roleblockerDefinition);
    const doctor = assignRole(room, players[1]!, doctorDefinition);
    const target = assignRole(room, players[2]!, doctorDefinition);
    room.systems = new GameSystems(room);

    blocker.handleNightAction(players[1]!);
    doctor.handleNightAction(players[2]!);
    room.systems.visits.resolveNight();

    expect(target.defence).toBe(CombatLevel.None);
    expect(doctor.visiting).toBeNull();
  });

  it("jailor jails by day and can execute the jailed target at night", () => {
    const { room, players } = createRoomWithPlayers("role-jailor", [
      "jailor",
      "target",
    ]);
    const jailor = assignRole(room, players[0]!, jailorDefinition);
    const target = assignRole(room, players[1]!, doctorDefinition);

    jailor.handleDayAction(players[1]!);
    jailor.dayVisit();
    expect(target.jailed).toBe(jailor);

    jailor.handleNightAction(players[0]!);
    jailor.visit();
    expect(target.damage).toBe(CombatLevel.High);
    expect(target.attackers).toEqual([jailor]);
  });

  it("nimby consumes alert charges and rejects alerting after charges are exhausted", () => {
    const { room, players } = createRoomWithPlayers("role-nimby", ["nimby"]);
    const nimby = assignRole(room, players[0]!, nimbyDefinition);

    for (let i = 0; i < 3; i += 1) {
      nimby.handleNightAction(players[0]!);
      nimby.visit();
      nimby.resetNightState();
    }

    expect(nimby.getPersistentCharge("nimby-alert-slots")).toBe(0);
    nimby.handleNightAction(players[0]!);
    expect(nimby.visiting).toBeNull();
  });

  it("fortifier stores a persistent fortified target and later strips it", () => {
    const { room, players } = createRoomWithPlayers("role-fortifier", [
      "fortifier",
      "target",
    ]);
    const fortifier = assignRole(room, players[0]!, fortifierDefinition);
    const target = assignRole(room, players[1]!, doctorDefinition);
    setDeterministicRandom(room, [0]);

    fortifier.handleNightAction(players[1]!);
    fortifier.visit();
    expect(fortifier.getPersistentTarget("fortifier-target")).toBe(target);
    expect(target.baseDefence).toBe(CombatLevel.Medium);

    fortifier.resetNightState();
    fortifier.handleNightAction(players[1]!);
    fortifier.visit();
    expect(fortifier.getPersistentTarget("fortifier-target")).toBeNull();
    expect(target.baseDefence).toBe(CombatLevel.None);
    expect(target.damage).toBe(CombatLevel.Fatal);
  });

  it("framer wins when its marked target is voted out", () => {
    const { room, players } = createRoomWithPlayers("role-framer", [
      "framer",
      "target",
    ]);
    const framer = assignRole(room, players[0]!, framerDefinition);
    const target = assignRole(room, players[1]!, doctorDefinition);
    framer.setPersistentTarget("framer-current-target", target);

    framer.onPlayerVotedOut(target);

    expect(framer.victoryCondition).toBe(true);
  });

  it("lawman becomes insane after shooting a town member", () => {
    const { room, players } = createRoomWithPlayers("role-lawman", [
      "lawman",
      "town",
    ]);
    const lawman = assignRole(room, players[0]!, lawmanDefinition);
    const target = assignRole(room, players[1]!, doctorDefinition);

    lawman.handleNightAction(players[1]!);
    lawman.visit();

    expect(target.damage).toBe(CombatLevel.Low);
    expect(lawman.isInsane).toBe(true);
  });
});
