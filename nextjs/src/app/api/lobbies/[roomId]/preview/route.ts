import { lobbyRoomIdSchema } from "@mernmafia/shared/game/lobbyPreview";
import { loadLobbyPreview } from "~/server/lobbyPreview";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  if (!lobbyRoomIdSchema.safeParse(roomId).success)
    return Response.json({ error: "Invalid room." }, { status: 400 });
  try {
    const preview = await loadLobbyPreview(roomId);
    return Response.json(preview ?? { error: "No custom setup found." }, {
      status: preview ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Unable to load this game’s setup." },
      { status: 503 },
    );
  }
}
