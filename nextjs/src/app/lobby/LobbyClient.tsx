"use client";
import { useCallback, useState } from "react";
import { useGameLobby } from "./hooks/useGameLobby";
import { LobbyView } from "./LobbyView";

export default function LobbyClient({
  roomId,
  initialPractice = false,
  initialSpectator = false,
  noteOwnerId,
}: {
  roomId: string;
  initialPractice?: boolean;
  initialSpectator?: boolean;
  noteOwnerId?: string;
}) {
  const [currentRoomId, setCurrentRoomId] = useState(roomId);
  const [practice, setPractice] = useState(initialPractice);
  const [spectating, setSpectating] = useState(initialSpectator);
  const refreshRoom = useCallback(async () => {
    const response = await fetch("/api/matchmaking/current", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { roomId?: unknown };
    if (typeof data.roomId === "string" && data.roomId !== currentRoomId)
      setCurrentRoomId(data.roomId);
  }, [currentRoomId]);
  const handleRoomFull = useCallback(() => {
    void refreshRoom();
  }, [refreshRoom]);
  const lobby = useGameLobby(
    currentRoomId,
    spectating ? undefined : handleRoomFull,
    practice,
    spectating ? "spectator" : "player",
    noteOwnerId,
  );
  return (
    <LobbyView
      lobby={lobby}
      roomId={currentRoomId}
      practice={practice}
      onPracticeChange={setPractice}
      onSpectate={() => setSpectating(true)}
      noteOwnerId={noteOwnerId}
      spectating={spectating}
    />
  );
}
