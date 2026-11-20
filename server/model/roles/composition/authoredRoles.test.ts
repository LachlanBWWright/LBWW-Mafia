import { beforeAll, describe, expect, it } from "vitest";
import { customRoleSchema, createCustomRoleDraft } from "@mernmafia/shared/game/customRoles";
import { Room } from "../../rooms/room.js";
import { Player } from "../../player/player.js";
import { User } from "../../user/user.js";
import { setGameEmitter } from "../../../servers/emitter.js";
import { compileAuthoredRole, createRoleInstance } from "./roleFactory.js";
import { CombatLevel } from "../combatLevel.js";

beforeAll(() => setGameEmitter({ to: () => ({ emit: () => {} }), in: () => ({ disconnectSockets: () => {} }) }));
function scenario(overrides: Record<string, unknown> = {}) {
  const room = new Room(3, "authored-test");
  const players = ["actor", "target", "other"].map(name => new Player(new User({ id: name, data: {}, join() {} }, name)));
  room.playerList = players;
  const definition = compileAuthoredRole({ ...createCustomRoleDraft(), ...overrides });
  const roles = players.map(player => { const role = createRoleInstance(definition, room, player); player.assignRole(role); return role; });
  return { room, players, actor: roles[0]!, target: roles[1]!, other: roles[2]! };
}
describe("authored roles through the real role lifecycle", () => {
  it("rejects code, unsupported victories and contradictory authoring choices", () => {
    for (const extra of [{ code: "evil()" }, { winCondition: "solo" }, { effect: "redirect", target: "any" }, { charges: 0 }, { investigationAccuracy: 20 }])
      expect(customRoleSchema.safeParse({ ...createCustomRoleDraft(), ...extra }).success).toBe(false);
  });
  it("consumes charges only on execution; replacing a queued target is free", () => {
    const { actor, target, other } = scenario({ charges: 1 });
    expect(actor.handleNightAction(target.player)).toBe(true);
    expect(actor.handleNightAction(other.player)).toBe(true);
    actor.visit();
    expect(target.defence).toBe(CombatLevel.None);
    expect(other.defence).toBe(CombatLevel.Low);
    expect(actor.handleNightAction(target.player)).toBe(false);
    actor.visit(); // duplicate lifecycle invocation cannot execute a second time
    expect(target.defence).toBe(CombatLevel.None);
  });
  it("enforces cooldown, target repetition and independent per-player budgets", () => {
    const { room, actor, target, other } = scenario({ charges: 3, cooldownNights: 1 });
    actor.handleNightAction(target.player); actor.visit();
    room.dayNumber += 1;
    expect(actor.handleNightAction(other.player)).toBe(false);
    room.dayNumber += 1;
    expect(actor.handleNightAction(target.player)).toBe(true);
    expect(actor.handleNightAction(other.player)).toBe(true);
    expect(target.handleNightAction(actor.player)).toBe(true);
  });
  it("reports exhausted, cooling down and target-limited abilities without exposing roleblocks", () => {
    const { room, actor, target, other } = scenario({ charges: 2, cooldownNights: 1 });
    actor.roleblocked = true;
    expect(actor.canSubmitNightAction()).toBe(true);
    actor.roleblocked = false;
    actor.handleNightAction(target.player); actor.visit();
    expect(actor.canSubmitNightAction()).toBe(false);
    room.dayNumber += 2;
    other.player.isAlive = false;
    expect(actor.canSubmitNightAction()).toBe(true); // skipped night permits the original target
    other.player.isAlive = true;
    expect(actor.canSubmitNightAction()).toBe(true);
    actor.handleNightAction(other.player); actor.visit();
    room.dayNumber += 2;
    expect(actor.canSubmitNightAction()).toBe(false);
  });
  it("withholds consecutive-night targets but restores them after a skipped night", () => {
    const { room, actor, target, other } = scenario({ charges: 3 });
    actor.handleNightAction(target.player); actor.visit();
    room.dayNumber += 1;
    other.player.isAlive = false;
    expect(actor.canSubmitNightAction()).toBe(false);
    expect(actor.handleNightAction(target.player)).toBe(false);
    room.dayNumber += 1;
    expect(actor.canSubmitNightAction()).toBe(true);
    expect(actor.handleNightAction(target.player)).toBe(true);
  });
  it("does not spend a charge when blocked and rejects self/dead targets", () => {
    const { actor, target } = scenario({ charges: 1 });
    expect(actor.handleNightAction(actor.player)).toBe(false);
    actor.handleNightAction(target.player); actor.roleblocked = true; actor.visit();
    actor.roleblocked = false;
    expect(actor.handleNightAction(target.player)).toBe(true);
    actor.visit(); expect(target.defence).toBe(CombatLevel.Low);
  });
  it("resolves Mafia faction attacks without spending the authored ability charge", () => {
    const { room, actor, target, other } = scenario({ alignment: "mafia", charges: 1, noRepeatTarget: false });
    actor.visiting = target;
    actor.setFactionAction({ kind: "attack", damage: CombatLevel.Low });
    actor.visit();
    expect(target.damage).toBe(CombatLevel.Low);
    room.dayNumber += 1;
    expect(actor.handleNightAction(other.player)).toBe(true);
    actor.visit();
    expect(other.defence).toBe(CombatLevel.Low);
  });
  it.each(["attack", "block", "redirect"])("executes %s in the actual runtime", effect => {
    const { actor, target, other } = scenario({ effect });
    target.visiting = other;
    expect(actor.handleNightAction(target.player)).toBe(true); actor.visit();
    if (effect === "attack") { expect(target.damage).toBe(CombatLevel.Low); expect(target.attackers).toContain(actor); }
    if (effect === "block") { expect(target.roleblocked).toBe(true); expect(actor.roleblocker).toBe(true); }
    if (effect === "redirect") { expect(target.visiting).toBe(actor); expect(actor.roleblocker).toBe(true); }
  });
});
