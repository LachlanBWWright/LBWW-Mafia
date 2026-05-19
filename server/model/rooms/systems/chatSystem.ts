import { ServerEvent } from "@mernmafia/shared/communication/events";
import {
  MessageKey,
  type GameMessage,
} from "@mernmafia/shared/communication/messages";
import type { Player } from "../../player/player.js";
import type { ChatRole } from "../../roles/roleContracts.js";
import { GamePhase } from "../gamePhase.js";
import type { Room } from "../room.js";

type ChatOutcome =
  | { kind: "actor-notice"; player: Player; message: GameMessage }
  | { kind: "room-chat"; message: string }
  | { kind: "private-chat"; recipients: Player[]; message: string }
  | { kind: "faction-chat"; message: string; tapTarget: Player | null };

function resolveChatOutcome(role: ChatRole, message: string): ChatOutcome {
  const formattedMessage = `${role.player.username}: ${message}`;

  if (role.room.time === GamePhase.Day) {
    if (role.silenced) {
      return {
        kind: "actor-notice",
        player: role.player,
        message: { key: MessageKey.SilencedCannotTalk },
      };
    }
    return { kind: "room-chat", message: formattedMessage };
  }

  if (role.jailed !== null) {
    return {
      kind: "private-chat",
      recipients: [role.player, role.jailed.player],
      message: formattedMessage,
    };
  }

  if (!role.faction) {
    return {
      kind: "actor-notice",
      player: role.player,
      message: { key: MessageKey.CannotSpeakAtNight },
    };
  }

  return {
    kind: "faction-chat",
    message,
    tapTarget: role.nightTappedBy?.player ?? null,
  };
}

export class ChatSystem {
  constructor(private readonly room: Room) {}

  handleRoleMessage(role: ChatRole, message: string): void {
    const outcome = resolveChatOutcome(role, message);

    if (outcome.kind === "actor-notice") {
      this.sendActorNotice(outcome.player, outcome.message);
      return;
    }

    if (outcome.kind === "room-chat") {
      this.room.messenger.emitToRoom(ServerEvent.ReceiveChatMessage, outcome.message);
      return;
    }

    if (outcome.kind === "private-chat") {
      this.room.messenger.emitToPlayers(
        outcome.recipients,
        ServerEvent.ReceiveChatMessage,
        outcome.message,
      );
      return;
    }

    role.faction?.handleNightMessage(outcome.message, role.player.username);
    if (outcome.tapTarget) {
      this.room.messenger.emitToPlayer(
        outcome.tapTarget,
        ServerEvent.ReceiveChatMessage,
        `${role.player.username}: ${outcome.message}`,
      );
    }
  }

  sendActorNotice(
    player: Player,
    message: GameMessage,
    event = ServerEvent.ReceiveMessage,
  ): void {
    this.room.messenger.emitToPlayer(player, event, message);
  }

  blockMessages(player: Player): void {
    this.room.messenger.emitToPlayer(player, ServerEvent.BlockMessages);
  }
}
