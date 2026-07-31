import LobbyClient from "./LobbyClient";
import { Header } from "~/components/header";
import { trpcServices } from "~/server/trpc/services";

export const dynamic = "force-dynamic";

export default async function LobbyPage() {
  const { roomId } = await trpcServices.getCurrentRoom();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <LobbyClient roomId={roomId} />
    </div>
  );
}
