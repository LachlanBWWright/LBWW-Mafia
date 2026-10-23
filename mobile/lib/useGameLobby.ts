import { roomResumeStorageKey } from "../../shared/game/resumeIdentity";
import { PracticeSocket } from "../../shared/game/practiceSocket";
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
const practiceTicket = async () => undefined;
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
export function useGameLobby(
  roomId: string,
  practice = false,
  joinMode: "player" | "spectator" = "player",
  resumeScope = "guest",
) {
  const [seat, setSeat] = useState<{
    roomId: string;
    mode: string;
    scope: string;
    key: string;
  }>();
  useEffect(() => {
    let active = true;
    const storageKey = roomResumeStorageKey(roomId, joinMode, resumeScope);
    void SecureStore.getItemAsync(storageKey)
      .then(async (stored) => {
        const key = stored ?? randomUUID();
        if (!stored) await SecureStore.setItemAsync(storageKey, key);
        if (active)
          setSeat({ roomId, mode: joinMode, scope: resumeScope, key });
      })
      .catch(() => {
        if (active)
          setSeat({
            roomId,
            mode: joinMode,
            scope: resumeScope,
            key: randomUUID(),
          });
      });
    return () => {
      active = false;
    };
  }, [roomId, joinMode, resumeScope]);
  const resumeKey =
    seat?.roomId === roomId &&
    seat.mode === joinMode &&
    seat.scope === resumeScope
      ? seat.key
      : undefined;
  const socket = useMemo(() => {
    if (practice) return new PracticeSocket();
    const url = process.env.EXPO_PUBLIC_SOCKET_URL;
    if (!url || !resumeKey) return null;
    const type =
      process.env.EXPO_PUBLIC_SOCKET_BACKEND === "socketio"
        ? "socketio"
        : process.env.EXPO_PUBLIC_SOCKET_BACKEND === "supabase"
          ? "supabase"
          : "partyserver";
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
  }, [roomId, resumeKey, practice, joinMode, resumeScope]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active" && !socket?.connected) socket?.connect();
    });
    return () => subscription.remove();
  }, [socket]);
  return useSharedGameLobby(
    socket,
    practice ? practiceTicket : getTicket,
    undefined,
    joinMode,
  );
}
