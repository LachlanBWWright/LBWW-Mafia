import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import type { Player } from "../../player/player.js";
import type { Room } from "../room.js";
import { RoleTrait } from "../../roles/composition/roleTraits.js";

export class VictorySystem {
  constructor(private readonly room: Room) {}

  handlePlayerVotedOut(player: Player): void {
    if (player.role.hasTrait(RoleTrait.Confesser)) {
      this.room.messenger.emitToRoom(ServerEvent.ReceiveMessage, {
        key: MessageKey.ConfeserVotedOut,
        params: { playerName: player.username },
      });
      this.room.confesserVotedOut = true;
      player.role.victoryCondition = true;
      this.room.messenger.emitToRoom(ServerEvent.DisableVoting);
    } else {
      this.room.messenger.emitToRoom(ServerEvent.ReceiveMessage, {
        key: MessageKey.PlayerVotedOutByTown,
        params: { playerName: player.username },
      });
    }

    for (const candidate of this.room.playerList) {
      candidate.role.onPlayerVotedOut(player.role);
    }
  }

  onNoDeathDraw(): void {
    for (const player of this.room.playerList) {
      player.role.onNoDeathDraw();
    }
  }
}
