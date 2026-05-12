import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";
import type { Player } from "../../player/player.js";
import { CombatLevel } from "../combatLevel.js";
import { RoleGroup } from "../roleGroup.js";
import type { ComposedRole } from "../composition/composedRole.js";
import type { RoleHandlerDefinition } from "../composition/handlers/types.js";

export function chooseNightOther(
  role: ComposedRole,
  recipient: Player,
  selfKey: MessageKey,
  successKey: MessageKey,
): boolean {
  if (recipient === role.player) {
    io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: selfKey });
    return true;
  }
  if (!recipient.isAlive) {
    io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.InvalidChoice });
    return true;
  }
  io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
    key: successKey,
    params: { targetName: recipient.username },
  });
  role.visiting = recipient.role;
  return true;
}

export function chooseDayOther(
  role: ComposedRole,
  recipient: Player,
  selfKey: MessageKey,
  successKey: MessageKey,
): boolean {
  if (recipient === role.player) {
    io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: selfKey });
    return true;
  }
  if (!recipient.isAlive) {
    io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, { key: MessageKey.InvalidChoice });
    return true;
  }
  io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
    key: successKey,
    params: { targetName: recipient.username },
  });
  role.dayVisiting = recipient.role;
  return true;
}

export function roleblockVisit(townAlways = true): RoleHandlerDefinition {
  return {
    onNightVisit: ({ role }) => {
      if (role.visiting === null) return;
      if (townAlways || role.visiting.group === RoleGroup.Town || Math.random() > 0.5) {
        role.visiting.roleblocked = true;
        role.visiting.receiveVisit(role);
      }
    },
  };
}

export function simpleAttack(level: CombatLevel): RoleHandlerDefinition {
  return {
    onNightVisit: ({ role }) => {
      if (role.visiting === null) return;
      role.visiting.receiveVisit(role);
      if (role.visiting.damage < level) {
        role.visiting.damage = level;
      }
      role.visiting.attackers.push(role);
    },
  };
}
