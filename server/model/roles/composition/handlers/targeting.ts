import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import type { Player } from "../../../player/player.js";
import type { Role } from "../../abstractRole.js";
import type { RoleInstance } from "../roleInstance.js";
import { accepted, rejected } from "./results.js";
import { actorNotice, dispatchNotice } from "./notices.js";
import { chooseDayTarget, chooseNightTarget } from "./effects.js";

function rejectTarget(role: RoleInstance, key: MessageKey) {
  dispatchNotice(role, actorNotice({ key }));
  return rejected;
}

function acceptTarget(
  role: RoleInstance,
  recipient: Player,
  successKey: MessageKey,
): void {
  dispatchNotice(role, {
    target: "actor",
    event: ServerEvent.ReceiveMessage,
    message: {
      key: successKey,
      params: { targetName: recipient.username },
    },
  });
}

/**
 * Chooses a living non-self night target.
 *
 * @param role - Acting role.
 * @param recipient - Proposed target.
 * @param selfKey - Message shown when self-targeting is not allowed.
 * @param successKey - Message shown when the target is accepted.
 * @returns Explicit command result.
 */
export function chooseNightOther(
  role: RoleInstance,
  recipient: Player,
  selfKey: MessageKey,
  successKey: MessageKey,
) {
  if (recipient === role.player) {
    return rejectTarget(role, selfKey);
  }
  if (!recipient.isAlive) {
    return rejectTarget(role, MessageKey.InvalidChoice);
  }
  acceptTarget(role, recipient, successKey);
  chooseNightTarget(role, recipient.role);
  return accepted;
}

/**
 * Chooses a living non-self day target.
 *
 * @param role - Acting role.
 * @param recipient - Proposed target.
 * @param selfKey - Message shown when self-targeting is not allowed.
 * @param successKey - Message shown when the target is accepted.
 * @returns Explicit command result.
 */
export function chooseDayOther(
  role: RoleInstance,
  recipient: Player,
  selfKey: MessageKey,
  successKey: MessageKey,
) {
  if (recipient === role.player) {
    return rejectTarget(role, selfKey);
  }
  if (!recipient.isAlive) {
    return rejectTarget(role, MessageKey.InvalidChoice);
  }
  acceptTarget(role, recipient, successKey);
  chooseDayTarget(role, recipient.role);
  return accepted;
}

/**
 * Chooses a living target and optionally allows self-targeting.
 *
 * @param role - Acting role.
 * @param recipient - Proposed target.
 * @param successKey - Message shown when the target is accepted.
 * @param applySelection - Callback that stores the chosen target.
 * @returns Explicit command result.
 */
export function chooseLivingTarget(
  role: RoleInstance,
  recipient: Player,
  successKey: MessageKey,
  applySelection: (target: Role) => void,
) {
  if (!recipient.isAlive) {
    return rejectTarget(role, MessageKey.InvalidChoice);
  }
  dispatchNotice(role, {
    target: "actor",
    event: ServerEvent.ReceiveMessage,
    message: {
      key: successKey,
      params: { targetName: recipient.username },
    },
  });
  applySelection(recipient.role);
  return accepted;
}

/**
 * Chooses another living target using a caller-provided selection callback.
 *
 * @param role - Acting role.
 * @param recipient - Proposed target.
 * @param selfKey - Message shown when self-targeting is not allowed.
 * @param successKey - Message shown when the target is accepted.
 * @param applySelection - Callback that stores the chosen target.
 * @returns Explicit command result.
 */
export function chooseOtherLivingTarget(
  role: RoleInstance,
  recipient: Player,
  selfKey: MessageKey,
  successKey: MessageKey,
  applySelection: (target: Role) => void,
) {
  if (recipient === role.player) {
    return rejectTarget(role, selfKey);
  }
  if (!recipient.isAlive) {
    return rejectTarget(role, MessageKey.InvalidChoice);
  }
  dispatchNotice(role, {
    target: "actor",
    event: ServerEvent.ReceiveMessage,
    message: {
      key: successKey,
      params: { targetName: recipient.username },
    },
  });
  applySelection(recipient.role);
  return accepted;
}

/**
 * Creates a structured actor notice for a target selection.
 *
 * @param recipient - Accepted recipient.
 * @param successKey - Message key to emit.
 * @returns Structured notice.
 */
export function targetChosenNotice(
  recipient: Player,
  successKey: MessageKey,
) {
  return {
    target: "actor" as const,
    event: ServerEvent.ReceiveMessage,
    message: {
      key: successKey,
    params: { targetName: recipient.username },
    },
  };
}
