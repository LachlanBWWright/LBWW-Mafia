import LobbyClient from "./LobbyClient";
import { trpcServices } from "~/server/trpc/services";

export const dynamic = "force-dynamic";

export default async function LobbyPage() {
  const { roomId } = await trpcServices.getCurrentRoom();
  return <LobbyClient roomId={roomId} />;
}
