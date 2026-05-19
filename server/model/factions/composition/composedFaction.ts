import { ServerEvent } from "@mernmafia/shared/communication/events";
import type { GameMessage } from "@mernmafia/shared/communication/messages";
import {
  initializeFactionMembers,
  type GameFaction,
} from "../factionContracts.js";
import type { Player } from "../../player/player.js";
import type { Room } from "../../rooms/room.js";
import type { FactionDefinition, FactionContext } from "./factionDefinition.js";
import {
  createFactionRuntimeState,
  type FactionRuntimeState,
} from "./factionRuntimeState.js";
import type { GameRole } from "../../roles/roleContracts.js";
import type { FactionNightActionIntent } from "../nightIntent.js";

export class ComposedFaction implements GameFaction {
  memberList: Player[] = [];
  readonly definition: FactionDefinition;
  readonly room: Room;
  readonly state: FactionRuntimeState;

  constructor(definition: FactionDefinition, room: Room) {
    this.definition = definition;
    this.room = room;
    this.state = createFactionRuntimeState();
  }

  private get context(): FactionContext {
    return { room: this.room, faction: this };
  }

  hasMembers(playerList: Player[]): boolean {
    return playerList.some((player) => this.definition.membership.includes(player, this.context));
  }

  refreshMembers(playerList: Player[]): void {
    this.memberList = playerList.filter((player) => this.definition.membership.includes(player, this.context));
  }

  findMembers(playerList: Player[]): void {
    this.refreshMembers(playerList);
    initializeFactionMembers(this);
    this.broadcastMemberRoles();
  }

  sendMessage(message: GameMessage): void {
    if (this.definition.onSendMessage) {
      this.definition.onSendMessage(this.context, message);
      return;
    }
    this.room.messenger.emitToPlayers(
      this.memberList,
      ServerEvent.ReceiveMessage,
      message,
    );
  }

  sendNotice(event: ServerEvent, message: GameMessage | string): void {
    this.room.messenger.emitToPlayers(this.memberList, event, message);
  }

  sendPlayerNotice(
    player: Player,
    event: ServerEvent,
    message: GameMessage | string,
  ): void {
    this.room.messenger.emitToPlayer(player, event, message);
  }

  recordNightVote(actor: GameRole, target: GameRole | null): void {
    const voteKey = actor.player.id;
    if (target === null) {
      this.state.votes.delete(voteKey);
      return;
    }
    this.state.votes.set(voteKey, target);
  }

  readNightVotes(): GameRole[] {
    return [...this.state.votes.values()];
  }

  clearNightVotes(): void {
    this.state.votes.clear();
  }

  setNightIntents(intents: FactionNightActionIntent[]): void {
    this.state.intents = intents;
  }

  drainNightIntents(): FactionNightActionIntent[] {
    const intents = [...this.state.intents];
    this.state.intents = [];
    return intents;
  }

  handleNightVote(): void {
    this.setNightIntents(this.definition.votePolicy?.resolveVotes(this.context) ?? []);
  }

  handleNightMessage(message: string, playerUsername: string): void {
    this.definition.chatPolicy.handleNightMessage(this.context, message, playerUsername);
  }

  removeMembers(): void {
    this.memberList = this.memberList.filter((member) =>
      this.definition.cleanupPolicy.keepMember(member, this.context),
    );
  }

  private broadcastMemberRoles(): void {
    for (const member of this.memberList) {
      for (const targetMember of this.memberList) {
        this.room.messenger.emitToPlayer(
          targetMember,
          ServerEvent.UpdateFactionRole,
          {
            name: member.username,
            role: member.role.name,
          },
        );
      }
    }
  }
}
