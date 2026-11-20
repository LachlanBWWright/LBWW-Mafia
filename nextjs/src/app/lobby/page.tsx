import { auth } from "~/server/auth";
import LobbyClient from "./LobbyClient";
import { Header } from "~/components/header";
import { loadLobbyPreview } from "~/server/lobbyPreview";
import { trpcServices } from "~/server/trpc/services";

export const dynamic = "force-dynamic";

export default async function LobbyPage({
  searchParams,
}: {
  searchParams?: Promise<{
    room?: string | string[];
    spectate?: string;
    practice?: string;
  }>;
}) {
  const params = await searchParams;
  const requestedRoom = params?.room;
  const practice = params?.practice === "1";
  const session = await auth();
  const roomId = practice
    ? "practice"
    : typeof requestedRoom === "string" &&
        /^[A-Za-z0-9_-]{1,64}$/.test(requestedRoom)
      ? requestedRoom
      : (await trpcServices.getCurrentRoom()).roomId;
  let preview;
  let previewFailed = false;
  try {
    if (!practice) preview = await loadLobbyPreview(roomId);
  } catch {
    previewFailed = true;
  }
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <LobbyClient
        key={`${roomId}:${params?.spectate ?? "0"}:${practice}:${session?.user?.id ?? "guest"}`}
        roomId={roomId}
        isMatchmaking={typeof requestedRoom !== "string"}
        preview={preview}
        previewFailed={previewFailed}
        noteOwnerId={session?.user?.id}
        initialSpectator={params?.spectate === "1"}
        initialPractice={practice}
      />
    </div>
  );
}
