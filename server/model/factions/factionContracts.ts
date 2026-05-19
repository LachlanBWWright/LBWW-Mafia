import type { GameMessage } from "@mernmafia/shared/communication/messages";
import type { ServerEvent } from "@mernmafia/shared/communication/events";
import type { Player } from "../player/player.js";
import type { FactionNightActionIntent } from "./nightIntent.js";
import type { GameRole } from "../roles/roleContracts.js";

export interface GameFaction {
  memberList: Player[];
  findMembers(playerList: Player[]): void;
  sendMessage(message: GameMessage): void;
  handleNightVote(): void;
  handleNightMessage(message: string, playerUsername: string): void;
  removeMembers(): void;
  drainNightIntents(): FactionNightActionIntent[];
  recordNightVote(actor: GameRole, target: GameRole | null): void;
  readNightVotes(): GameRole[];
  clearNightVotes(): void;
  sendNotice(event: ServerEvent, message: GameMessage | string): void;
  sendPlayerNotice(
    player: Player,
    event: ServerEvent,
    message: GameMessage | string,
  ): void;
}

export function initializeFactionMembers(faction: GameFaction): void {
  for (const member of faction.memberList) {
    member.role.assignFaction(faction);
  }
}
