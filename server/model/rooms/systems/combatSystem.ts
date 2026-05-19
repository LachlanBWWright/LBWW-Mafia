import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import type { Room } from "../room.js";
import type { CombatRole } from "../../roles/roleContracts.js";
import { CombatLevel } from "../../roles/combatLevel.js";
import { resolveDamageOutcome } from "./combatResolution.js";

export class CombatSystem {
  constructor(private readonly room: Room) {}

  resolveRoleDamage(role: CombatRole): boolean {
    const outcome = resolveDamageOutcome(role);

    if (outcome.kind === "died") {
      this.room.messenger.emitToPlayer(role.player, ServerEvent.ReceiveMessage, {
        key: MessageKey.YouHaveDied,
      });
      this.room.messenger.emitToPlayer(role.player, ServerEvent.BlockMessages);
      this.room.messenger.emitToRoom(ServerEvent.ReceiveMessage, {
        key: MessageKey.PlayerHasDied,
        params: {
          playerName: role.player.username,
          roleName: role.name.toLowerCase(),
        },
      });
      role.player.isAlive = false;
      this.room.messenger.emitToRoom(ServerEvent.UpdatePlayerRole, {
        name: role.player.username,
        role: role.name,
      });
    } else if (outcome.kind === "survived") {
      this.room.messenger.emitToPlayer(role.player, ServerEvent.ReceiveMessage, {
        key: MessageKey.AttackedButSurvived,
      });
    }

    role.defence = role.baseDefence;
    role.damage = CombatLevel.None;
    role.attackers = [];
    return outcome.kind === "died";
  }

  resolveNightCleanup(nightNumber: number, drawTriggerDays: number): boolean {
    let somebodyDied = false;
    for (const player of this.room.playerList) {
      if (!player.isAlive) continue;
      if (this.resolveRoleDamage(player.role)) {
        somebodyDied = true;
        this.room.endDay = nightNumber + drawTriggerDays;
      }
      player.role.onNightCleanup();
    }
    return somebodyDied;
  }
}
