"use client";

import { useEffect, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import type { RecentMatchSummary } from "@mernmafia/shared/trpc/appRouter";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

type RecentMatchesProps = {
  username?: string;
  title: string;
  currentUser?: boolean;
};

function createClient() {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
      }),
    ],
  });
}

export function RecentMatches({
  username = "",
  title,
  currentUser = false,
}: RecentMatchesProps) {
  const [matches, setMatches] = useState<RecentMatchSummary[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [trpcClient] = useState(createClient);

  useEffect(() => {
    if (!currentUser && !username.trim()) {
      return;
    }

    const request = currentUser
      ? trpcClient.match.recentForCurrentUser.query({ limit: 10 })
      : trpcClient.match.recentByUsername.query({ username, limit: 10 });
    void request
      .then((result: RecentMatchSummary[]) => {
        setMatches(result);
        setError("");
        setHasLoaded(true);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load match history.";
        setError(message);
        setHasLoaded(true);
      });
  }, [currentUser, trpcClient, username]);

  return (
    <RecentMatchesView
      title={title}
      matches={matches}
      hasLoaded={hasLoaded}
      error={error}
      canLoad={currentUser || !!username.trim()}
    />
  );
}

export function RecentMatchesView({
  title,
  matches = [],
  hasLoaded = true,
  error = "",
  canLoad = true,
}: {
  title: string;
  matches?: RecentMatchSummary[];
  hasLoaded?: boolean;
  error?: string;
  canLoad?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!canLoad ? (
          <p className="text-muted-foreground text-sm">
            No username available for history lookup.
          </p>
        ) : error ? (
          <p className="text-muted-foreground text-sm">{error}</p>
        ) : !hasLoaded ? (
          <p className="text-muted-foreground text-sm">
            Loading recent matches...
          </p>
        ) : matches.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No recent matches found.
          </p>
        ) : null}
        {matches.map((match) => (
          <div
            key={match.id}
            className="border-border/70 rounded-md border p-3 text-sm"
          >
            <p className="font-medium">
              Match #{match.id} • {match.winningFaction} won
            </p>
            <p className="text-muted-foreground">
              {new Date(match.endedAt).toLocaleString()} • {match.roomName}
            </p>
            <p className="text-muted-foreground">
              Winners: {match.winningRoles.join(", ") || "None"} • Events:{" "}
              {match.conversationCount + match.actionCount}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
