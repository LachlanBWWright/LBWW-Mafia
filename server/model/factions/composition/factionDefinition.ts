import type { GameMessage } from "@mernmafia/shared/communication/messages";
import type { Player } from "../../player/player.js";
import type { Room } from "../../rooms/room.js";
import type { ComposedFaction } from "./composedFaction.js";

export type FactionContext = {
  room: Room;
  faction: ComposedFaction;
};

export interface FactionMembershipRule {
  includes(player: Player, context: FactionContext): boolean;
}

export interface FactionChatPolicy {
  handleNightMessage(context: FactionContext, message: string, playerUsername: string): void;
}

export interface FactionVotePolicy {
  resolveVotes(context: FactionContext): void;
}

export interface FactionCleanupPolicy {
  keepMember(player: Player, context: FactionContext): boolean;
}

export type FactionDefinition = {
  id: string;
  name: string;
  membership: FactionMembershipRule;
  chatPolicy: FactionChatPolicy;
  votePolicy?: FactionVotePolicy;
  cleanupPolicy: FactionCleanupPolicy;
  onSendMessage?: (context: FactionContext, message: GameMessage) => void;
};
