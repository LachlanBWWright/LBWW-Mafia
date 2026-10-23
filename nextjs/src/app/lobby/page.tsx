import { auth } from "~/server/auth";
import LobbyClient from "./LobbyClient";
import { Header } from "~/components/header";
import { trpcServices } from "~/server/trpc/services";

export const dynamic = "force-dynamic";

export default async function LobbyPage({
  searchParams,
}: {
  searchParams?: Promise<{ room?: string | string[]; spectate?: string }>;
}) {
  const params = await searchParams;
  const requestedRoom = params?.room;
  const session = await auth();
  const roomId =
    typeof requestedRoom === "string" &&
    /^[A-Za-z0-9_-]{1,64}$/.test(requestedRoom)
      ? requestedRoom
      : (await trpcServices.getCurrentRoom()).roomId;
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <LobbyClient
        key={`${roomId}:${params?.spectate ?? "0"}:${session?.user?.id ?? "guest"}`}
        roomId={roomId}
        noteOwnerId={session?.user?.id}
        initialSpectator={params?.spectate === "1"}
      />
    </div>
  );
}
