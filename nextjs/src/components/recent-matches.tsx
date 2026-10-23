"use client";

import { useEffect, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import type { RecentMatchSummary } from "@mernmafia/shared/trpc/appRouter";
import { Button } from "~/components/ui/button";
import { MatchReplayView, MatchBalanceView } from "./match-analysis";
import { matchOutcome } from "@mernmafia/shared/game/replayPresentation";
import {
  recentMatchIdentity,
  startHistoryRequest,
} from "./recent-match-requests";
import type {
  MatchReplay,
  MatchBalanceSummary,
} from "@mernmafia/shared/trpc/matchAnalysis";

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
  return (
    <RecentMatchesContent
      key={recentMatchIdentity(username, currentUser)}
      username={username.trim()}
      title={title}
      currentUser={currentUser}
    />
  );
}

function RecentMatchesContent({
  username,
  title,
  currentUser,
}: Required<RecentMatchesProps>) {
  const [matches, setMatches] = useState<RecentMatchSummary[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [trpcClient] = useState(createClient);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [replay, setReplay] = useState<MatchReplay | null>(null);
  const [replayError, setReplayError] = useState("");
  const [replayLoading, setReplayLoading] = useState(false);
  const [balance, setBalance] = useState<MatchBalanceSummary | null>(null);
  const [balanceError, setBalanceError] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showBalance, setShowBalance] = useState(false);

  useEffect(() => {
    if (selectedMatch === null) return;
    return startHistoryRequest(
      (signal) =>
        trpcClient.match.replay.query({ matchId: selectedMatch }, { signal }),
      setReplay,
      setReplayError,
      "Could not load replay.",
      () => setReplayLoading(false),
    );
  }, [selectedMatch, trpcClient]);

  useEffect(() => {
    if (!showBalance || !currentUser) return;
    return startHistoryRequest(
      (signal) => trpcClient.match.balance.query({ limit: 200 }, { signal }),
      setBalance,
      setBalanceError,
      "Could not load game balance.",
      () => setBalanceLoading(false),
    );
  }, [showBalance, currentUser, trpcClient]);

  useEffect(() => {
    if (!currentUser && !username.trim()) {
      return;
    }

    return startHistoryRequest(
      (signal) =>
        currentUser
          ? trpcClient.match.recentForCurrentUser.query(
              { limit: 10 },
              { signal },
            )
          : trpcClient.match.recentByUsername.query(
              { username, limit: 10 },
              { signal },
            ),
      (result) => {
        setMatches(result);
        setError("");
        setHasLoaded(true);
      },
      (message) => {
        setError(message);
        setHasLoaded(true);
      },
      "Failed to load match history.",
    );
  }, [currentUser, trpcClient, username]);

  return (
    <div className="space-y-8">
      {currentUser ? (
        <div className="flex gap-2">
          <Button
            variant={!showBalance ? "secondary" : "outline"}
            aria-pressed={!showBalance}
            onClick={() => setShowBalance(false)}
          >
            Recent matches
          </Button>
          <Button
            variant={showBalance ? "secondary" : "outline"}
            aria-pressed={showBalance}
            onClick={() => {
              if (showBalance) return;
              setBalanceLoading(true);
              setBalanceError("");
              setShowBalance(true);
            }}
          >
            Game balance
          </Button>
        </div>
      ) : null}
      {showBalance ? (
        balanceLoading ? (
          <p role="status">Loading game balance...</p>
        ) : balanceError ? (
          <p role="alert">{balanceError}</p>
        ) : balance ? (
          <MatchBalanceView balance={balance} />
        ) : null
      ) : (
        <>
          <RecentMatchesView
            title={title}
            matches={matches}
            hasLoaded={hasLoaded}
            error={error}
            canLoad={currentUser || !!username.trim()}
            onOpenReplay={
              currentUser
                ? (matchId) => {
                    if (selectedMatch === matchId) return;
                    setReplayLoading(true);
                    setReplay(null);
                    setReplayError("");
                    setSelectedMatch(matchId);
                  }
                : undefined
            }
          />
          {selectedMatch !== null ? (
            <div className="border-border space-y-4 border-t pt-6">
              <Button variant="outline" onClick={() => setSelectedMatch(null)}>
                Close replay
              </Button>
              {replayLoading ? (
                <p role="status">Loading replay...</p>
              ) : replayError ? (
                <p role="alert">{replayError}</p>
              ) : replay ? (
                <MatchReplayView replay={replay} />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function RecentMatchesView({
  title,
  matches = [],
  hasLoaded = true,
  error = "",
  canLoad = true,
  onOpenReplay,
}: {
  title: string;
  matches?: RecentMatchSummary[];
  hasLoaded?: boolean;
  error?: string;
  canLoad?: boolean;
  onOpenReplay?: (matchId: number) => void;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="divide-border divide-y">
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
          <div key={match.id} className="space-y-1 py-4 text-sm">
            <p className="font-medium">
              Match #{match.id} • {matchOutcome(match.winningFaction)}
            </p>
            <p className="text-muted-foreground">
              {new Date(match.endedAt).toLocaleString()} • {match.roomName}
            </p>
            <p className="text-muted-foreground">
              Winners: {match.winningRoles.join(", ") || "None"} • Events:{" "}
              {match.conversationCount + match.actionCount}
            </p>
            {onOpenReplay ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onOpenReplay(match.id)}
              >
                Open replay
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
