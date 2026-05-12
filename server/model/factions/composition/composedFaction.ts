import { ServerEvent } from "@mernmafia/shared/communication/events";
import type { GameMessage } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";
import { Faction } from "../abstractFaction.js";
import type { Player } from "../../player/player.js";
import type { Room } from "../../rooms/room.js";
import type { FactionDefinition, FactionContext } from "./factionDefinition.js";
import {
  createFactionRuntimeState,
  type FactionRuntimeState,
} from "./factionRuntimeState.js";
import type { Role } from "../../roles/abstractRole.js";
import type { FactionNightActionIntent } from "../nightIntent.js";

export class ComposedFaction extends Faction {
  readonly definition: FactionDefinition;
  readonly room: Room;
  readonly state: FactionRuntimeState;

  constructor(definition: FactionDefinition, room: Room) {
    super();
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

  override findMembers(playerList: Player[]): void {
    this.refreshMembers(playerList);
    this.initializeMembers();
  }

  override sendMessage(message: GameMessage): void {
    if (this.definition.onSendMessage) {
      this.definition.onSendMessage(this.context, message);
      return;
    }
    for (const member of this.memberList) {
      io.to(member.user.socketId).emit(ServerEvent.ReceiveMessage, message);
    }
  }

  sendNotice(event: ServerEvent, message: GameMessage | string): void {
    for (const member of this.memberList) {
      io.to(member.user.socketId).emit(event, message);
    }
  }

  sendPlayerNotice(
    player: Player,
    event: ServerEvent,
    message: GameMessage | string,
  ): void {
    io.to(player.user.socketId).emit(event, message);
  }

  override recordNightVote(actor: Role, target: Role | null): void {
    const voteKey = actor.player.user.socketId;
    if (target === null) {
      this.state.votes.delete(voteKey);
      return;
    }
    this.state.votes.set(voteKey, target);
  }

  override readNightVotes(): Role[] {
    return [...this.state.votes.values()];
  }

  override clearNightVotes(): void {
    this.state.votes.clear();
  }

  setNightIntents(intents: FactionNightActionIntent[]): void {
    this.state.intents = intents;
  }

  override drainNightIntents(): FactionNightActionIntent[] {
    const intents = [...this.state.intents];
    this.state.intents = [];
    return intents;
  }

  override handleNightVote(): void {
    this.setNightIntents(this.definition.votePolicy?.resolveVotes(this.context) ?? []);
  }

  override handleNightMessage(message: string, playerUsername: string): void {
    this.definition.chatPolicy.handleNightMessage(this.context, message, playerUsername);
  }

  override removeMembers(): void {
    this.memberList = this.memberList.filter((member) =>
      this.definition.cleanupPolicy.keepMember(member, this.context),
    );
  }
}
