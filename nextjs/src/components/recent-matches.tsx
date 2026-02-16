"use client";

import { useEffect, useMemo, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import type { RecentMatchSummary } from "../../../shared/trpc/appRouter";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

type RecentMatchesProps = {
  username: string;
  title: string;
};

export function RecentMatches({ username, title }: RecentMatchesProps) {
  const [matches, setMatches] = useState<RecentMatchSummary[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");

  const trpcClient = useMemo(
    () =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpBatchLink({
            url: "/api/trpc",
            transformer: superjson,
          }),
        ],
      }),
    [],
  );

  useEffect(() => {
    if (!username.trim()) {
      return;
    }

    void trpcClient.match.recentByUsername
      .query({ username, limit: 10 })
      .then((result: RecentMatchSummary[]) => {
        setMatches(result);
        setError("");
        setHasLoaded(true);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Failed to load match history.";
        setError(message);
        setHasLoaded(true);
      });
  }, [trpcClient, username]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!username.trim() ? (
          <p className="text-sm text-muted-foreground">
            No username available for history lookup.
          </p>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : !hasLoaded ? (
          <p className="text-sm text-muted-foreground">Loading recent matches...</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent matches found.</p>
        ) : null}
        {matches.map((match) => (
          <div key={match.id} className="rounded-md border border-border/70 p-3 text-sm">
            <p className="font-medium">
              Match #{match.id} • {match.winningFaction} won
            </p>
            <p className="text-muted-foreground">
              {new Date(match.endedAt).toLocaleString()} • {match.roomName}
            </p>
            <p className="text-muted-foreground">
              Winners: {match.winningRoles.join(", ") || "None"} • Events: {match.conversationCount + match.actionCount}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
