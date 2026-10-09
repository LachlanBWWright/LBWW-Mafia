"use client";
import { avatarOptions } from "@mernmafia/shared/trpc/accountFeatures";

import { useCallback, useEffect, useState } from "react";
import type { SocialUser } from "@mernmafia/shared/trpc/appRouter";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "~/server/trpc/router";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { PlayerReports } from "./player-reports";
import { ReportPlayer } from "./report-player";
import { Input } from "./ui/input";

const makeClient = () =>
  createTRPCProxyClient<AppRouter>({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
  });

type CommunityViewProps = {
  users: SocialUser[];
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onInvite?: (user: SocialUser) => void;
  onAction: (
    user: SocialUser,
    action: "request" | "respond" | "remove" | "block",
  ) => void;
};

export function CommunityView({
  users,
  query,
  onQueryChange,
  onSearch,
  onAction,
  onInvite,
}: CommunityViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Players and friends</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
          className="flex gap-2"
        >
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search names or handles"
            aria-label="Search players"
          />
          <Button>Search</Button>
        </form>
        {users.length === 0 ? (
          <p className="text-muted-foreground text-sm">No players found.</p>
        ) : null}
        {users.map((user) => (
          <div
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0"
          >
            <div>
              <p className="flex items-center gap-2 font-medium">
                <span
                  className={`h-2 w-2 rounded-full ${user.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                  role="img"
                  aria-label={user.isOnline ? "Online" : "Offline"}
                />
                {
                  avatarOptions.find(
                    (avatar) => avatar.id === user.avatarPreset,
                  )?.symbol
                }{" "}
                {user.name ?? "Player"}
              </p>
              <p className="text-muted-foreground text-xs">
                {user.handle ? `@${user.handle}` : "No public handle"} ·{" "}
                {user.isOnline ? "Online" : "Offline"} · {user.relationship}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.relationship === "none" ? (
                <Button size="sm" onClick={() => onAction(user, "request")}>
                  Add friend
                </Button>
              ) : null}
              {user.relationship === "incoming" ? (
                <Button size="sm" onClick={() => onAction(user, "respond")}>
                  Accept
                </Button>
              ) : null}
              {user.relationship === "friend" && onInvite ? (
                <Button size="sm" onClick={() => onInvite(user)}>
                  Invite
                </Button>
              ) : null}
              <ReportPlayer userId={user.id} name={user.name ?? "Player"} />
              {user.relationship === "friend" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAction(user, "remove")}
                >
                  Remove
                </Button>
              ) : null}
              {user.relationship !== "blocked" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAction(user, "block")}
                >
                  Block
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function Community() {
  const [client] = useState(makeClient);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [inviteUser, setInviteUser] = useState<SocialUser | null>(null);
  const [hostedRooms, setHostedRooms] = useState<{ roomId: string }[]>([]);
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);
  const [users, setUsers] = useState<SocialUser[]>([]);
  const load = useCallback(
    () => client.social.search.query({ query }).then(setUsers),
    [client, query],
  );

  useEffect(() => {
    void client.features.hostedLobbies
      .query()
      .then(setHostedRooms)
      .catch(() => undefined);
    void client.social.search
      .query({ query: "" })
      .then(setUsers)
      .catch(() => setStatus("Unable to load players."));
  }, [client]);

  async function act(
    user: SocialUser,
    action: "request" | "respond" | "remove" | "block",
  ) {
    if (action === "request")
      await client.social.request.mutate({ userId: user.id });
    if (action === "respond")
      await client.social.respond.mutate({ userId: user.id, accept: true });
    if (action === "remove")
      await client.social.remove.mutate({ userId: user.id });
    if (action === "block")
      await client.social.block.mutate({ userId: user.id });
    await load();
  }

  async function invite() {
    if (!inviteUser) return;
    setBusy(true);
    try {
      const roomId = room.trim();
      await client.features.invite.mutate({
        recipientId: inviteUser.id,
        roomId,
      });
      setStatus("Invitation sent.");
      setInviteUser(null);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to send invitation.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <CommunityView
        users={users}
        query={query}
        onQueryChange={setQuery}
        onSearch={() =>
          void load().catch(() => setStatus("Unable to load players."))
        }
        onInvite={setInviteUser}
        onAction={(user, action) =>
          void act(user, action).catch(() =>
            setStatus("Unable to update relationship."),
          )
        }
      />
      {inviteUser ? (
        <form
          className="space-y-2 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void invite();
          }}
        >
          <h2 className="font-semibold">
            Invite {inviteUser.name ?? "player"}
          </h2>
          <label className="block text-sm">
            Your lobby
            <select
              className="bg-background block w-full rounded-md border p-2"
              value={room}
              onChange={(event) => setRoom(event.target.value)}
            >
              <option value="">Choose a lobby</option>
              {hostedRooms.map((item) => (
                <option key={item.roomId} value={item.roomId}>
                  {item.roomId}
                </option>
              ))}
            </select>
          </label>
          <Input
            aria-label="Lobby ID"
            placeholder="Your lobby ID"
            value={room}
            onChange={(event) => setRoom(event.target.value)}
            maxLength={128}
          />
          <Button disabled={busy || !room.trim()}>
            {busy ? "Sending…" : "Send invitation"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setInviteUser(null)}
          >
            Cancel
          </Button>
        </form>
      ) : null}
      {status ? (
        <p role="status" className="py-2 text-sm">
          {status}
        </p>
      ) : null}
      <PlayerReports />
    </>
  );
}
