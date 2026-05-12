import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../../servers/emitter.js";
import type { Player } from "../../../player/player.js";
import type { ComposedRole } from "../composedRole.js";

export function chooseOtherLivingTarget(
  role: ComposedRole,
  recipient: Player,
  selfKey: MessageKey,
  successKey: MessageKey,
): boolean {
  if (recipient === role.player) {
    io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: selfKey,
    });
    return false;
  }
  if (!recipient.isAlive) {
    io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
      key: MessageKey.InvalidChoice,
    });
    return false;
  }
  io.to(role.player.user.socketId).emit(ServerEvent.ReceiveMessage, {
    key: successKey,
    params: { targetName: recipient.username },
  });
  role.visiting = recipient.role;
  return true;
}
