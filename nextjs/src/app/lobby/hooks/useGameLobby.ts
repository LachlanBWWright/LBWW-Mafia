"use client";
import { roomResumeStorageKey } from "@mernmafia/shared/game/resumeIdentity";
import { PracticeSocket } from "@mernmafia/shared/game/practiceSocket";
import * as React from "react";
import { useMemo, useSyncExternalStore } from "react";
import {
  createResumeIdentityStore,
  noServerResumeIdentity,
} from "./resumeIdentityStore";
import { io } from "socket.io-client";
import { createGameSocket } from "@mernmafia/shared/communication/createGameSocket";
import { createUseSharedGameLobby } from "@mernmafia/shared/game/useGameLobby";
export type { LobbyState as GameLobbyState } from "@mernmafia/shared/game/lobbyState";
export type { LobbyActions as GameLobbyActions } from "@mernmafia/shared/game/useGameLobby";
export type { PlayerList as Player } from "@mernmafia/shared/communication/events";
const useSharedGameLobby = createUseSharedGameLobby(React);
const practiceTicket = async () => undefined;
async function getTicket() {
  const response = await fetch("/api/account/game-ticket");
  if (!response.ok) return undefined;
  const body = (await response.json()) as { token?: string };
  return body.token;
}
export function useGameLobby(
  roomId: string,
  onRoomFull?: () => void,
  practice = false,
  joinMode: "player" | "spectator" = "player",
  resumeScope = "guest",
) {
  const identity = roomResumeStorageKey(roomId, joinMode, resumeScope);
  const identityStore = useMemo(
    () =>
      createResumeIdentityStore(
        identity,
        !practice && !!process.env.NEXT_PUBLIC_SOCKET_URL,
      ),
    [identity, practice],
  );
  const resumeKey = useSyncExternalStore(
    identityStore.subscribe,
    identityStore.getSnapshot,
    noServerResumeIdentity,
  );
  const socket = useMemo(() => {
    if (practice) return new PracticeSocket();
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!url || !resumeKey) return null;
    const type =
      process.env.NEXT_PUBLIC_SOCKET_BACKEND === "socketio"
        ? "socketio"
        : process.env.NEXT_PUBLIC_SOCKET_BACKEND === "supabase"
          ? "supabase"
          : "partyserver";
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
  }, [roomId, practice, resumeKey]);
  return useSharedGameLobby(
    socket,
    practice ? practiceTicket : getTicket,
    onRoomFull,
    joinMode,
  );
}
