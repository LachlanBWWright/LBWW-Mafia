"use client";

import { useCallback, useEffect, useState } from "react";
import type { SocialUser } from "@mernmafia/shared/trpc/appRouter";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "~/server/trpc/router";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
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
            className="flex items-center justify-between border-b py-3 last:border-0"
          >
            <div>
              <p className="font-medium">{user.name ?? "Player"}</p>
              <p className="text-muted-foreground text-xs">
                {user.handle ? `@${user.handle}` : "No public handle"} ·{" "}
                {user.relationship}
              </p>
            </div>
            <div className="flex gap-2">
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
  const [users, setUsers] = useState<SocialUser[]>([]);
  const load = useCallback(
    () => client.social.search.query({ query }).then(setUsers),
    [client, query],
  );

  useEffect(() => {
    void client.social.search.query({ query: "" }).then(setUsers);
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

  return (
    <CommunityView
      users={users}
      query={query}
      onQueryChange={setQuery}
      onSearch={() => void load()}
      onAction={(user, action) => void act(user, action)}
    />
  );
}
