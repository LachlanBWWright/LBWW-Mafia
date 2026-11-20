"use client";
import { useCallback, useEffect, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import { useGameLobby } from "./hooks/useGameLobby";
import { LobbyView } from "./LobbyView";
import { GameSetupSummary } from "./GameSetupSummary";
import { Button } from "~/components/ui/button";
import {
  requestLobbyPreview,
  type LobbyPreview,
} from "@mernmafia/shared/game/lobbyPreview";

function ConnectedLobbyClient({
  roomId,
  isMatchmaking = false,
  initialPractice = false,
  initialSpectator = false,
  noteOwnerId,
}: {
  roomId: string;
  isMatchmaking?: boolean;
  initialPractice?: boolean;
  initialSpectator?: boolean;
  noteOwnerId?: string;
}) {
  const [currentRoomId, setCurrentRoomId] = useState(roomId);
  const [practice, setPractice] = useState(initialPractice);
  const [reducedMotion, setReducedMotion] = useState(Boolean(noteOwnerId));
  useEffect(() => {
    let active = true;
    if (!noteOwnerId) return;
    const client = createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })] });
    void client.account.profile.query().then((profile) => { if (active) setReducedMotion(profile.reducedMotion); }).catch(() => { if (active) setReducedMotion(false); });
    return () => { active = false; };
  }, [noteOwnerId]);
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
    spectating || !isMatchmaking ? undefined : handleRoomFull,
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
      reducedMotion={!!noteOwnerId && reducedMotion}
    />
  );
}

export default function LobbyClient(props: {
  roomId: string;
  isMatchmaking?: boolean;
  initialPractice?: boolean;
  initialSpectator?: boolean;
  noteOwnerId?: string;
  preview?: LobbyPreview | null;
  previewFailed?: boolean;
}) {
  const [preview, setPreview] = useState(props.preview);
  const [failed, setFailed] = useState(props.previewFailed ?? false);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  async function retry() {
    setBusy(true);
    try {
      setPreview(await requestLobbyPreview(props.roomId));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  if (failed && !props.initialPractice)
    return (
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <p role="alert">Unable to load this game’s setup. Please try again.</p>
        <Button disabled={busy} onClick={() => void retry()}>
          Retry setup
        </Button>
      </main>
    );
  if (preview && !joined && !props.initialPractice)
    return (
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-8">
        <h1 className="text-2xl font-semibold">Game setup</h1>
        <p>{preview.size} players</p>
        <GameSetupSummary setup={preview.setup} />
        <Button onClick={() => setJoined(true)}>
          {props.initialSpectator ? "Watch match" : "Join match"}
        </Button>
      </main>
    );
  return <ConnectedLobbyClient {...props} />;
}
