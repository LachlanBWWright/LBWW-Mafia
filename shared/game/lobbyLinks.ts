/** Public lobby links never carry account credentials or private room access tokens. */
export const isLobbyRoomId = (roomId: string): boolean =>
  /^[a-zA-Z0-9_-]{1,64}$/.test(roomId);

export function createLobbyLink(origin: string, roomId: string): string {
  if (!isLobbyRoomId(roomId)) throw new Error("Invalid lobby ID.");
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Invalid website URL.");
  }
  if (url.username || url.password) throw new Error("Invalid website URL.");
  url.pathname = "/lobby";
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", roomId);
  return url.toString();
}

/** Restrict HTTPS links to the app website; allow the registered native scheme. */
export function parseLobbyLink(
  value: string,
  trustedOrigin: string,
): string | null {
  try {
    const url = new URL(value);
    const native = url.protocol === "mernmafia:" && url.hostname === "lobby";
    const web =
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.origin === new URL(trustedOrigin).origin &&
      url.pathname === "/lobby";
    if (!native && !web) return null;
    if (
      url.username ||
      url.password ||
      (native && url.pathname !== "" && url.pathname !== "/")
    )
      return null;
    const rooms = url.searchParams.getAll("room");
    return rooms.length === 1 && isLobbyRoomId(rooms[0]!) ? rooms[0]! : null;
  } catch {
    return null;
  }
}
