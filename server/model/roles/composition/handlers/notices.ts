import { ServerEvent } from "@mernmafia/shared/communication/events";
import type { GameMessage } from "@mernmafia/shared/communication/messages";
import { io } from "../../../../servers/emitter.js";
import type { Player } from "../../../player/player.js";
import type { Room } from "../../../rooms/room.js";
import type { Role } from "../../abstractRole.js";
import type { ComposedFaction } from "../../../factions/composition/composedFaction.js";
import type { GameNotice } from "../resultTypes.js";

function emitToPlayer(
  player: Player,
  event: ServerEvent,
  message: GameMessage | string,
): void {
  io.to(player.user.socketId).emit(event, message);
}

/**
 * Dispatches a single notice relative to a role instance.
 *
 * @param role - Role acting as the notice anchor.
 * @param notice - Notice to dispatch.
 */
export function dispatchNotice(role: Role, notice: GameNotice): void {
  if (notice.target === "actor") {
    emitToPlayer(role.player, notice.event, notice.message);
    return;
  }
  if (notice.target === "target") {
    const target = role.visiting;
    if (target) {
      emitToPlayer(target.player, notice.event, notice.message);
    }
    return;
  }
  if (notice.target === "room") {
    io.to(role.room.name).emit(notice.event, notice.message);
    return;
  }
  if (notice.target === "faction") {
    const faction = role.faction as ComposedFaction | undefined;
    if (!faction) return;
    faction.sendNotice(notice.event, notice.message);
    return;
  }
  emitToPlayer(notice.target, notice.event, notice.message);
}

/**
 * Dispatches multiple notices relative to a role instance.
 *
 * @param role - Role acting as the notice anchor.
 * @param notices - Notices to dispatch.
 */
export function dispatchNotices(role: Role, notices: GameNotice[]): void {
  for (const notice of notices) {
    dispatchNotice(role, notice);
  }
}

/**
 * Creates a room-scoped system notice.
 *
 * @param message - Message payload.
 * @param event - Server event to emit.
 * @returns Structured notice.
 */
export function roomNotice(
  message: GameMessage | string,
  event = ServerEvent.ReceiveMessage,
): GameNotice {
  return { target: "room", event, message };
}

/**
 * Creates an actor-scoped system notice.
 *
 * @param message - Message payload.
 * @param event - Server event to emit.
 * @returns Structured notice.
 */
export function actorNotice(
  message: GameMessage | string,
  event = ServerEvent.ReceiveMessage,
): GameNotice {
  return { target: "actor", event, message };
}

/**
 * Creates a target-scoped system notice.
 *
 * @param message - Message payload.
 * @param event - Server event to emit.
 * @returns Structured notice.
 */
export function targetNotice(
  message: GameMessage | string,
  event = ServerEvent.ReceiveMessage,
): GameNotice {
  return { target: "target", event, message };
}

/**
 * Creates a faction-scoped system notice.
 *
 * @param message - Message payload.
 * @param event - Server event to emit.
 * @returns Structured notice.
 */
export function factionNotice(
  message: GameMessage | string,
  event = ServerEvent.ReceiveMessage,
): GameNotice {
  return { target: "faction", event, message };
}

/**
 * Emits a direct message to a room without needing a role anchor.
 *
 * @param room - Room that should receive the notice.
 * @param event - Event to emit.
 * @param message - Payload to emit.
 */
export function dispatchRoomNotice(
  room: Room,
  event: ServerEvent,
  message: GameMessage | string,
): void {
  io.to(room.name).emit(event, message);
}
