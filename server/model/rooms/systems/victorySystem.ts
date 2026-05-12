import { ServerEvent } from "@mernmafia/shared/communication/events";
import { MessageKey } from "@mernmafia/shared/communication/messages";
import { io } from "../../../servers/emitter.js";
import type { Player } from "../../player/player.js";
import type { Room } from "../room.js";
import { RoleTrait } from "../../roles/composition/roleTraits.js";

export class VictorySystem {
  constructor(private readonly room: Room) {}

  handlePlayerVotedOut(player: Player): void {
    if (player.role.hasTrait(RoleTrait.Confesser)) {
      io.to(this.room.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.ConfeserVotedOut,
        params: { playerName: player.username },
      });
      this.room.confesserVotedOut = true;
      player.role.victoryCondition = true;
      io.to(this.room.name).emit(ServerEvent.DisableVoting);
    } else {
      io.to(this.room.name).emit(ServerEvent.ReceiveMessage, {
        key: MessageKey.PlayerVotedOutByTown,
        params: { playerName: player.username },
      });
    }

    for (const candidate of this.room.playerList) {
      if ("onPlayerVotedOut" in candidate.role && typeof candidate.role.onPlayerVotedOut === "function") {
        candidate.role.onPlayerVotedOut(player.role);
      }
    }
  }

  onNoDeathDraw(): void {
    for (const player of this.room.playerList) {
      if ("onNoDeathDraw" in player.role && typeof player.role.onNoDeathDraw === "function") {
        player.role.onNoDeathDraw();
      }
    }
  }
}
