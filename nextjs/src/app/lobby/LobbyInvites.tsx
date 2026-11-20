"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import { createUseLobbyInvites } from "@mernmafia/shared/game/useLobbyInvites";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useRouter } from "next/navigation";
const useLobbyInvites = createUseLobbyInvites({
  useState,
  useEffect,
  useCallback,
  useRef,
});
export function LobbyInvites({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [client] = useState(() =>
    createTRPCProxyClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
    }),
  );
  const { isHost, friends, sent, error, busy, invite } = useLobbyInvites(
    client,
    roomId,
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [closeError, setCloseError] = useState("");
  const [closing, setClosing] = useState(false);
  async function closeLobby() {
    if (!window.confirm("Close this lobby for everyone?")) return;
    setClosing(true);
    setCloseError("");
    try {
      const response = await fetch(
        `/api/lobbies/${encodeURIComponent(roomId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error();
      router.push("/");
    } catch {
      setCloseError("Unable to close lobby. Try again.");
      setClosing(false);
    }
  }
  if (!isHost) return null;
  const visible = friends.filter((friend) =>
    `${friend.name ?? ""} ${friend.handle ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="border-b px-4 py-2">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          Invite friends
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={closing}
          onClick={() => void closeLobby()}
        >
          {closing ? "Closing…" : "Close lobby"}
        </Button>
      </div>
      {closeError ? <p role="alert">{closeError}</p> : null}
      {open ? (
        <div className="space-y-2 pt-3">
          <Input
            aria-label="Find friends"
            placeholder="Find friends…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {error ? <p role="alert">{error}</p> : null}
          {!visible.length ? (
            <p className="text-muted-foreground text-sm">No friends found.</p>
          ) : null}
          {visible.map((friend) => {
            const latest = sent.find((item) => item.recipientId === friend.id);
            const status = latest?.status;
            return (
              <div
                key={friend.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 truncate">
                  {friend.name ?? friend.handle ?? "Player"}
                </span>
                {status === "pending" || status === "accepted" ? (
                  <span className="text-muted-foreground text-sm">
                    {status === "accepted" ? "Accepted" : "Sent"}
                  </span>
                ) : (
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onClick={() => void invite(friend.id)}
                  >
                    {busy === friend.id ? "Sending…" : "Invite"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
