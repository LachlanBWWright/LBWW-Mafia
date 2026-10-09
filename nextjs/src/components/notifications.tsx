"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import type {
  AccountNotification,
  LobbyInvitation,
} from "@mernmafia/shared/trpc/accountFeatures";
import { Button } from "./ui/button";

export function NotificationsView({
  items,
  invitations,
  busy,
  onRead,
  onRespond,
}: {
  items: AccountNotification[];
  invitations: LobbyInvitation[];
  busy?: boolean;
  onRead: (id?: number) => void;
  onRespond: (id: number, accept: boolean) => void;
}) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <Button
          variant="outline"
          disabled={(busy ?? false) || !items.some((item) => !item.readAt)}
          onClick={() => onRead()}
        >
          Mark all read
        </Button>
      </div>
      {invitations
        .filter((invite) => invite.status === "pending")
        .map((invite) => (
          <div key={invite.id} className="space-y-2 border-b py-3">
            <p>
              {invite.senderName ?? "A friend"} invited you to lobby{" "}
              {invite.roomId}.
            </p>
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() => onRespond(invite.id, true)}
              >
                Accept and join
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onRespond(invite.id, false)}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      {!items.length ? (
        <p className="text-muted-foreground">No notifications yet.</p>
      ) : null}
      <ul className="divide-y">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-3 py-4"
          >
            <div>
              <Link
                className={
                  item.readAt ? "text-muted-foreground" : "font-medium"
                }
                href={
                  item.category === "message"
                    ? "/messages"
                    : item.category === "friend_request"
                      ? "/community"
                      : "/notifications"
                }
                onClick={() => onRead(item.id)}
              >
                {item.actorName ?? "A player"}
                {item.category === "message"
                  ? " sent you a message."
                  : item.category === "friend_request"
                    ? " sent a friend request."
                    : " invited you to a lobby."}
              </Link>
              <p className="text-muted-foreground text-xs">
                {item.createdAt.toLocaleString()}
              </p>
            </div>
            {!item.readAt ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => onRead(item.id)}
              >
                Mark read
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
export function Notifications() {
  const router = useRouter();
  const [client] = useState(() =>
    createTRPCProxyClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
    }),
  );
  const [items, setItems] = useState<AccountNotification[]>([]);
  const [invitations, setInvitations] = useState<LobbyInvitation[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [notifications, invites] = await Promise.all([
        client.features.inbox.query(),
        client.features.invitations.query(),
      ]);
      setItems(notifications);
      setInvitations(invites);
      setError("");
    } catch {
      setError("Unable to load notifications. Please try again.");
    }
  }, [client]);
  useEffect(() => {
    void Promise.resolve().then(load);
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);
  async function read(id?: number) {
    setBusy(true);
    try {
      await client.features.markRead.mutate({ id });
      await load();
    } catch {
      setError("Unable to mark notifications read.");
    } finally {
      setBusy(false);
    }
  }
  async function respond(id: number, accept: boolean) {
    setBusy(true);
    try {
      const result = await client.features.respondInvitation.mutate({
        id,
        accept,
      });
      if (result.roomId)
        router.push("/lobby?room=" + encodeURIComponent(result.roomId));
      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to respond to invitation.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <NotificationsView
        items={items}
        invitations={invitations}
        busy={busy}
        onRead={(id) => void read(id)}
        onRespond={(id, accept) => void respond(id, accept)}
      />
      {error ? (
        <div role="alert" className="space-y-2">
          <p>{error}</p>
          <Button variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : null}
    </>
  );
}
