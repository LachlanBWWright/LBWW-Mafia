import type { ServerEvent } from "@mernmafia/shared/communication/events";
import type { GameMessage } from "@mernmafia/shared/communication/messages";
import type { Player } from "../../player/player.js";

export type GameNotice = {
  target: "actor" | "target" | "room" | "faction" | Player;
  event: ServerEvent;
  message: GameMessage | string;
};
