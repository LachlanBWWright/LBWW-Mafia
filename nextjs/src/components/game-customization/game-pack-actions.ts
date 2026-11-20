import {
  createGamePack,
  decodeGamePack,
  encodeGamePack,
  exportGamePack,
  importGamePack,
} from "@mernmafia/shared/game/gameCustomization";
import type { LobbyConfig } from "@mernmafia/shared/game/lobbyConfig";

export function makePackDocument(name: string, config: LobbyConfig) {
  return exportGamePack(createGamePack(name, config));
}
export function makePackLink(
  origin: string,
  name: string,
  config: LobbyConfig,
) {
  return `${origin}/lobby/create#pack=${encodeGamePack(createGamePack(name, config))}`;
}
export function readPackInput(input: string) {
  const marker = input.indexOf("#pack=");
  return marker < 0
    ? importGamePack(input)
    : decodeGamePack(input.slice(marker + 6));
}
export function downloadPack(name: string, config: LobbyConfig) {
  const url = URL.createObjectURL(
    new Blob([makePackDocument(name, config)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^a-z0-9-]/gi, "-") || "mafia"}-v1.json`;
  link.click();
  URL.revokeObjectURL(url);
}
