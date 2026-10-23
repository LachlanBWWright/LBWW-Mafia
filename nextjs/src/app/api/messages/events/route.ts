import { auth } from "~/server/auth";
import { getActiveIdentity } from "~/server/auth/identity";
import { subscribeToDirectMessages } from "~/server/messaging/events";
import { createMessageStream } from "~/server/messaging/stream";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  const session = await auth();
  const identity = session?.user?.id
    ? await getActiveIdentity(session.user.id)
    : null;
  if (!identity) return new Response("Unauthorized", { status: 401 });
  const stream = createMessageStream(request.signal, (listener) =>
    subscribeToDirectMessages(identity.id, listener),
  );
  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
