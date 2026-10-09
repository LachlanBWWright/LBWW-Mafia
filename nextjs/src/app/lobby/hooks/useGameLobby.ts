"use client";
import * as React from "react";
import { useMemo } from "react";
import { io } from "socket.io-client";
import { createGameSocket } from "@mernmafia/shared/communication/createGameSocket";
import { createUseSharedGameLobby } from "@mernmafia/shared/game/useGameLobby";
export type { LobbyState as GameLobbyState } from "@mernmafia/shared/game/lobbyState";
export type { LobbyActions as GameLobbyActions } from "@mernmafia/shared/game/useGameLobby";
export type { PlayerList as Player } from "@mernmafia/shared/communication/events";
const useSharedGameLobby = createUseSharedGameLobby(React);
async function getTicket() {
  const response = await fetch("/api/account/game-ticket");
  if (!response.ok) return undefined;
  const body = (await response.json()) as { token?: string };
  return body.token;
}
export function useGameLobby(roomId: string, onRoomFull?: () => void) {
  const socket = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!url) return null;
    let resumeKey: string | undefined;
    if (typeof window !== "undefined") {
      const key = `mafia-room-resume:${roomId}`;
      try {
        resumeKey = window.sessionStorage.getItem(key) ?? crypto.randomUUID();
        window.sessionStorage.setItem(key, resumeKey);
      } catch {
        resumeKey = crypto.randomUUID();
      }
    }
    const type =
      process.env.NEXT_PUBLIC_SOCKET_BACKEND === "socketio"
        ? "socketio"
        : process.env.NEXT_PUBLIC_SOCKET_BACKEND === "supabase"
          ? "supabase"
          : "partykit";
    const result = createGameSocket(
      {
        type,
        url,
        room: roomId,
        autoConnect: false,
        resumeKey,
        apiKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      type === "socketio" ? io(url, { autoConnect: false }) : undefined,
    );
    return result.isOk() ? result.value : null;
  }, [roomId]);
  const captcha =
    process.env.NEXT_PUBLIC_CAPTCHA_TOKEN ??
    (process.env.NODE_ENV === "development" ? "dev-bypass-token" : "");
  return useSharedGameLobby(socket, captcha, getTicket, onRoomFull);
}
