import { roleSandboxInputSchema, type RoleSandboxResult } from "@mernmafia/shared/game/roleSandbox";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { Room } from "../../rooms/room.js";
import { Player } from "../../player/player.js";
import { User } from "../../user/user.js";
import { compileAuthoredRole, createRoleInstance } from "./roleFactory.js";
import { VisitResolutionSystem } from "../../rooms/systems/visitResolutionSystem.js";
import { CombatSystem } from "../../rooms/systems/combatSystem.js";

/** Runs real role commands and visits without timers, sockets, or a shared emitter. */
export function runRoleSandbox(raw: unknown): RoleSandboxResult {
  const input = roleSandboxInputSchema.parse(raw);
  let notices: string[] = [];
  let targetBlocked = false;
  const room = new Room(3, "role-sandbox", {
    to: (recipient) => ({ emit: (_event, ...args) => {
      const message = args[0];
      if (recipient === "sandbox-Target" && typeof message === "object" && message !== null && "key" in message && message.key === MessageKey.YouWereRoleblocked) targetBlocked = true;
      if (typeof message === "object" && message !== null && "key" in message) {
        if (message.key === MessageKey.JudgeAlignmentResult && "params" in message) {
          const params = message.params;
          if (typeof params === "object" && params !== null && "factionName" in params) notices.push(`Investigation: ${String(params.factionName)}`);
        } else notices.push(String(message.key));
      }
    } }),
    in: () => ({ disconnectSockets() {} }),
  });
  room.random = () => input.randomSample;
  const players = ["Actor", "Target", "Other"].map(name => new Player(new User({ id: `sandbox-${name}`, data: {}, join() {} }, name)));
  room.playerList = players;
  const actor = createRoleInstance(compileAuthoredRole(input.role), room, players[0]!);
  const target = createRoleInstance(compileAuthoredRole({ ...input.role, id: "sandbox-target", alignment: input.targetAlignment, effect: "attack", charges: undefined, cooldownNights: 0, noRepeatTarget: false, investigationAccuracy: 100 }), room, players[1]!);
  const other = createRoleInstance(compileAuthoredRole({ ...input.role, id: "sandbox-attacker", effect: "attack", charges: undefined, cooldownNights: 0, noRepeatTarget: false, investigationAccuracy: 100 }), room, players[2]!);
  [actor, target, other].forEach((role, index) => players[index]!.assignRole(role));
  const result: RoleSandboxResult = { nights: [] };
  const visits = new VisitResolutionSystem(room);
  const combat = new CombatSystem(room);
  for (let night = 1; night <= input.nights; night++) {
    notices = [];
    targetBlocked = false;
    room.dayNumber = night;
    // Each row is a fresh confrontation; only the authored actor's ability budget carries over.
    // Revive scripted participants so a prior simulated death cannot invalidate later budget tests.
    for (const player of players) player.isAlive = true;
    target.handleNightAction(other.player);
    if (input.incomingAttack) other.handleNightAction(target.player);
    const accepted = actor.handleNightAction(target.player);
    visits.resolveNight();
    const nightResult = { night, accepted, targetDamage: target.damage, targetDefence: target.defence, targetBlocked, redirectedToActor: target.visiting === actor, notices: [] as string[] };
    for (const role of [actor, target, other]) {
      const died = combat.resolveRoleDamage(role);
      if (died) notices.push(`${role.player.username} died.`);
      else if (role === target && input.incomingAttack) notices.push("Target survived the incoming attack.");
    }
    nightResult.notices = [...notices];
    result.nights.push(nightResult);
    actor.onNightCleanup(); target.onNightCleanup(); other.onNightCleanup();
  }
  return result;
}
