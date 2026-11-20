import { createGamePack, decodeGamePack, encodeGamePack, importGamePack } from "../../shared/game/gameCustomization";
import type { LobbyConfig } from "../../shared/game/lobbyConfig";
export function readTransferredGamePack(value: string) {
  const text = value.trim();
  if (text.startsWith("{")) return importGamePack(text);
  let url: URL;
  try { url = new URL(text); } catch { throw new Error("Paste game pack JSON or a shared game pack link."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Game pack links must use HTTP or HTTPS.");
  const payload = url.hash.startsWith("#pack=") ? url.hash.slice(6) : "";
  if (!payload) throw new Error("This link does not contain a game pack.");
  return decodeGamePack(payload);
}
export function createGamePackLink(name: string, config: LobbyConfig, baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/lobby/create#pack=${encodeGamePack(createGamePack(name, config))}`;
}
