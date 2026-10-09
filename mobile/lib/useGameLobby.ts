import { randomUUID } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import io from "socket.io-client";
import { createGameSocket } from "../../shared/communication/createGameSocket";
import { createUseSharedGameLobby } from "../../shared/game/useGameLobby";
import { getAccessToken } from "./mobileSession";
export type { LobbyState } from "../../shared/game/lobbyState";
export type { LobbyActions } from "../../shared/game/useGameLobby";
const useSharedGameLobby = createUseSharedGameLobby(React);
async function getTicket() {
  const token = await getAccessToken();
  if (!token) return undefined;
  const base =
    process.env.EXPO_PUBLIC_TRPC_URL?.replace(/\/api\/trpc$/, "") ??
    "http://localhost:3000";
  const response = await fetch(`${base}/api/account/game-ticket`, {
    signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) return undefined;
  const body = (await response.json()) as { token?: string };
  return body.token;
}
export function useGameLobby(roomId: string) {
  const [seat, setSeat] = useState<{ roomId: string; key: string }>();
  useEffect(() => {
    let active = true;
    const storageKey = `mafia-room-resume-${roomId}`;
    void SecureStore.getItemAsync(storageKey)
      .then(async (stored) => {
        const key = stored ?? randomUUID();
        if (!stored) await SecureStore.setItemAsync(storageKey, key);
        if (active) setSeat({ roomId, key });
      })
      .catch(() => {
        if (active) setSeat({ roomId, key: randomUUID() });
      });
    return () => {
      active = false;
    };
  }, [roomId]);
  const resumeKey = seat?.roomId === roomId ? seat.key : undefined;
  const socket = useMemo(() => {
    const url = process.env.EXPO_PUBLIC_SOCKET_URL;
    if (!url || !resumeKey) return null;
    const type =
      process.env.EXPO_PUBLIC_SOCKET_BACKEND === "socketio"
        ? "socketio"
        : process.env.EXPO_PUBLIC_SOCKET_BACKEND === "supabase"
          ? "supabase"
          : "partykit";
    const result = createGameSocket(
      {
        type,
        url,
        room: roomId,
        autoConnect: false,
        resumeKey,
        apiKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      },
      type === "socketio" ? io(url, { autoConnect: false }) : undefined,
    );
    return result.isOk() ? result.value : null;
  }, [roomId, resumeKey]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active" && !socket?.connected) socket?.connect();
    });
    return () => subscription.remove();
  }, [socket]);
  const captcha =
    process.env.EXPO_PUBLIC_CAPTCHA_TOKEN ??
    (process.env.NODE_ENV === "development" ? "dev-bypass-token" : "");
  return useSharedGameLobby(socket, captcha, getTicket);
}
