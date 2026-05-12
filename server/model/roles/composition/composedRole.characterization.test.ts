import { describe, expect, it, vi, afterEach, beforeAll } from "vitest";
import { User } from "../../user/user.js";
import { Player } from "../../player/player.js";
import { Room } from "../../rooms/room.js";
import { RoleFactory } from "./roleFactory.js";
import {
  confesserDefinition,
  framerDefinition,
  maniacDefinition,
} from "../definitions/neutral.js";
import {
  doctorDefinition,
  jailorDefinition,
  lawmanDefinition,
  roleblockerDefinition,
} from "../definitions/town.js";
import { mafiaDefinition } from "../definitions/mafia.js";
import { RoleHandler } from "../../rooms/initRoles/roleHandler.js";
import { GameSystems } from "../../rooms/systems/gameSystems.js";
import { CombatLevel } from "../combatLevel.js";
import { GamePhase } from "../../rooms/gamePhase.js";
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

function assignRole(room: Room, player: Player, definition: Parameters<typeof RoleFactory.createRole>[0]) {
  const role = RoleFactory.createRole(definition, room, player);
  player.assignRole(role);
  return role;
}

function wireRoom(room: Room): void {
  const roleHandler = new RoleHandler(room.playerList.length);
  room.factionList = roleHandler.assignFactionsFromPlayerList(room.playerList, room);
  for (const faction of room.factionList) {
    faction.findMembers(room.playerList);
  }
  room.systems = new GameSystems(room);
}

afterEach(() => {
  vi.restoreAllMocks();
});

beforeAll(() => {
  setGameEmitter({
    to: () => ({ emit: () => {} }),
    in: () => ({ disconnectSockets: () => {} }),
  });
});

describe("composed role characterization", () => {
  it("doctor cannot heal self", () => {
    const room = new Room(2, "room-self-heal");
    const doctorPlayer = createPlayer("doctor");
    room.playerList = [doctorPlayer];
    const doctor = assignRole(room, doctorPlayer, doctorDefinition);
    doctor.handleNightAction(doctorPlayer);
    expect(doctor.visiting).toBeNull();
  });

  it("doctor heals a night target by raising defence", () => {
    const room = new Room(2, "room-heal");
    const doctorPlayer = createPlayer("doctor");
    const targetPlayer = createPlayer("target");
    room.playerList = [doctorPlayer, targetPlayer];
    const doctor = assignRole(room, doctorPlayer, doctorDefinition);
    const target = assignRole(room, targetPlayer, maniacDefinition);

    doctor.handleNightAction(targetPlayer);
    doctor.visit();

    expect(target.defence).toBe(CombatLevel.Low);
  });

  it("mafia faction vote chooses attacker and applies damage", () => {
    const room = new Room(3, "room-mafia-vote");
    const mafiaA = createPlayer("mafia-a");
    const mafiaB = createPlayer("mafia-b");
    const victimPlayer = createPlayer("victim");
    room.playerList = [mafiaA, mafiaB, victimPlayer];
    const roleA = assignRole(room, mafiaA, mafiaDefinition);
    const roleB = assignRole(room, mafiaB, mafiaDefinition);
    const victim = assignRole(room, victimPlayer, maniacDefinition);

    wireRoom(room);
    roleA.handleNightVote(victimPlayer);
    roleB.handleNightVote(victimPlayer);

    vi.spyOn(Math, "random").mockReturnValue(0);
    room.systems?.factions.resolveNight();
    room.systems?.visits.resolveNight();

    expect(victim.damage).toBe(CombatLevel.Low);
    expect(victim.attackers.length).toBeGreaterThan(0);
  });

  it("roleblocker resolves before other visits and cancels roleblocked visit", () => {
    const room = new Room(3, "room-roleblock");
    const blockerPlayer = createPlayer("blocker");
    const attackerPlayer = createPlayer("attacker");
    const targetPlayer = createPlayer("target");
    room.playerList = [blockerPlayer, attackerPlayer, targetPlayer];
    const blocker = assignRole(room, blockerPlayer, roleblockerDefinition);
    const attacker = assignRole(room, attackerPlayer, maniacDefinition);
    assignRole(room, targetPlayer, doctorDefinition);

    wireRoom(room);
    blocker.handleNightAction(attackerPlayer);
    attacker.handleNightAction(targetPlayer);
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    room.systems?.visits.resolveNight();

    expect(attacker.roleblocked).toBe(false);
    expect(attacker.visiting).toBeNull();
  });

  it("jailor jails by day and can execute at night", () => {
    const room = new Room(2, "room-jail");
    const jailorPlayer = createPlayer("jailor");
    const victimPlayer = createPlayer("victim");
    room.playerList = [jailorPlayer, victimPlayer];
    const jailor = assignRole(room, jailorPlayer, jailorDefinition);
    const victim = assignRole(room, victimPlayer, doctorDefinition);

    jailor.handleDayAction(victimPlayer);
    jailor.dayVisit();
    expect(victim.jailed).toBe(jailor);

    jailor.handleNightAction(victimPlayer);
    jailor.visit();
    expect(victim.damage).toBe(CombatLevel.High);
  });

  it("framer wins if target is voted out", () => {
    const room = new Room(2, "room-framer");
    const framerPlayer = createPlayer("framer");
    const victimPlayer = createPlayer("victim");
    room.playerList = [framerPlayer, victimPlayer];
    const framer = assignRole(room, framerPlayer, framerDefinition);
    const victim = assignRole(room, victimPlayer, doctorDefinition);

    framer.state.custom.framer = { target: victim };
    framer.onPlayerVotedOut(victim);

    expect(framer.victoryCondition).toBe(true);
  });

  it("confesser voted out disables voting", () => {
    const room = new Room(2, "room-confesser");
    const confesserPlayer = createPlayer("confesser");
    const otherPlayer = createPlayer("other");
    room.playerList = [confesserPlayer, otherPlayer];
    const confesser = assignRole(room, confesserPlayer, confesserDefinition);
    assignRole(room, otherPlayer, doctorDefinition);
    room.systems = new GameSystems(room);

    room.systems.victory.handlePlayerVotedOut(confesserPlayer);

    expect(room.confesserVotedOut).toBe(true);
    expect(confesser.victoryCondition).toBe(true);
  });

  it("lawman insanity gets random forced visit via faction", () => {
    const room = new Room(3, "room-lawman");
    const lawmanPlayer = createPlayer("lawman");
    const targetA = createPlayer("a");
    const targetB = createPlayer("b");
    room.playerList = [lawmanPlayer, targetA, targetB];
    const lawman = assignRole(room, lawmanPlayer, lawmanDefinition);
    assignRole(room, targetA, doctorDefinition);
    assignRole(room, targetB, doctorDefinition);
    lawman.isInsane = true;

    wireRoom(room);
    vi.spyOn(Math, "random").mockReturnValue(0.8);
    room.systems?.factions.resolveNight();

    expect(lawman.visiting).not.toBeNull();
  });

  it("night cleanup clears temporary state", () => {
    const room = new Room(2, "room-cleanup");
    const p1 = createPlayer("one");
    const p2 = createPlayer("two");
    room.playerList = [p1, p2];
    const role1 = assignRole(room, p1, doctorDefinition);
    assignRole(room, p2, maniacDefinition);
    room.systems = new GameSystems(room);
    room.time = GamePhase.Processing;

    role1.visiting = role1;
    role1.dayVisiting = role1;
    role1.visitors = [role1];
    role1.attackers = [role1];
    role1.nightTapped = role1;
    role1.damage = CombatLevel.Low;

    room.systems.combat.resolveNightCleanup(2, 3);

    expect(role1.visiting).toBeNull();
    expect(role1.dayVisiting).toBeNull();
    expect(role1.visitors).toHaveLength(0);
    expect(role1.nightTapped).toBe(false);
    expect(role1.damage).toBe(CombatLevel.None);
  });
});
