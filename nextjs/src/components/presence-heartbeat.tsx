"use client";

import { useEffect } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";

const client = createTRPCProxyClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

export function PresenceHeartbeat({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const send = () => {
      void client.presence.heartbeat.mutate().catch(() => undefined);
    };
    send();
    const timer = window.setInterval(send, 30_000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  return null;
}
