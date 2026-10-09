import LobbyClient from "./LobbyClient";
import { Header } from "~/components/header";
import { trpcServices } from "~/server/trpc/services";

export const dynamic = "force-dynamic";

export default async function LobbyPage({
  searchParams,
}: {
  searchParams?: Promise<{ room?: string | string[] }>;
}) {
  const requestedRoom = (await searchParams)?.room;
  const roomId =
    typeof requestedRoom === "string" &&
    /^[A-Za-z0-9_-]{1,64}$/.test(requestedRoom)
      ? requestedRoom
      : (await trpcServices.getCurrentRoom()).roomId;
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <LobbyClient roomId={roomId} />
    </div>
  );
}
