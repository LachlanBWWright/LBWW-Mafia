import { ServerEvent } from "@mernmafia/shared/communication/events";
import type { GameMessage } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";
import { Faction } from "../abstractFaction.js";
import type { Player } from "../../player/player.js";
import type { Room } from "../../rooms/room.js";
import type { FactionDefinition, FactionContext } from "./factionDefinition.js";

export class ComposedFaction extends Faction {
  readonly definition: FactionDefinition;
  readonly room: Room;

  constructor(definition: FactionDefinition, room: Room) {
    super();
    this.definition = definition;
    this.room = room;
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

  override handleNightVote(): void {
    this.definition.votePolicy?.resolveVotes(this.context);
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
