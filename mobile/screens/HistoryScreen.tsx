import React, { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { StackParamList } from "../App";
import {
  fetchCurrentUserMatches,
  type RecentMatchSummary,
} from "../lib/appQueries";
import { useAppState } from "../context/AppStateContext";
import { Button, EmptyState, LoadingCard, Screen } from "../components/ui";

import { trpcClient } from "../lib/trpc";
import { MatchReplayView, MatchBalanceView } from "../components/MatchAnalysis";
import type {
  MatchReplay,
  MatchBalanceSummary,
} from "../../shared/trpc/matchAnalysis";
import { matchOutcome } from "../../shared/game/replayPresentation";

type HistoryScreenProps = NativeStackScreenProps<StackParamList, "History">;

function HistoryContent({
  loading,
  error,
  matches,
  navigation,
  onOpenReplay,
}: {
  loading: boolean;
  error: string;
  matches: RecentMatchSummary[];
  navigation: HistoryScreenProps["navigation"];
  onOpenReplay: (matchId: number) => void;
}) {
  if (loading) {
    return <LoadingCard label="Loading recent matches..." />;
  }
  if (error) {
    return (
      <EmptyState
        title="Could not load history."
        description={error}
        action={
          <Button onPress={() => navigation.navigate("Lobby")}>
            Back to Lobby
          </Button>
        }
      />
    );
  }
  if (matches.length === 0) {
    return (
      <EmptyState
        title="No recent matches found."
        description="This player has no match history yet."
      />
    );
  }
  return (
    <View className="gap-3">
      {matches.map((match) => (
        <View key={match.id} className="border-b border-border py-4">
          <View className="gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-[15px] font-extrabold text-foreground">
                Match #{match.id}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {matchOutcome(match.winningFaction)}
              </Text>
            </View>
            <Text className="text-xs leading-[18px] text-muted-foreground">
              {new Date(match.endedAt).toLocaleString()} • {match.roomName}
            </Text>
            <Text className="text-xs leading-[18px] text-muted-foreground">
              Winners: {match.winningRoles.join(", ") || "None"} • Events:{" "}
              {match.conversationCount + match.actionCount}
            </Text>
            <Button
              variant="outline"
              size="sm"
              onPress={() => onOpenReplay(match.id)}
            >
              Open replay
            </Button>
          </View>
        </View>
      ))}
    </View>
  );
}

export function HistoryScreen({ navigation }: HistoryScreenProps) {
  const { authToken } = useAppState();
  const [matches, setMatches] = useState<RecentMatchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [replay, setReplay] = useState<MatchReplay | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState("");
  const [showBalance, setShowBalance] = useState(false);
  const [balance, setBalance] = useState<MatchBalanceSummary | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState("");

  useEffect(() => {
    if (!authToken || selectedMatch === null) return;
    let active = true;
    setReplayLoading(true);
    setReplay(null);
    setReplayError("");
    void trpcClient.match.replay
      .query({ matchId: selectedMatch })
      .then((value) => {
        if (active) setReplay(value);
      })
      .catch((err: unknown) => {
        if (active)
          setReplayError(
            err instanceof Error ? err.message : "Could not load replay.",
          );
      })
      .finally(() => {
        if (active) setReplayLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedMatch, authToken]);
  useEffect(() => {
    if (!authToken || !showBalance) return;
    let active = true;
    setBalanceLoading(true);
    setBalanceError("");
    void trpcClient.match.balance
      .query({ limit: 200 })
      .then((value) => {
        if (active) setBalance(value);
      })
      .catch((err: unknown) => {
        if (active)
          setBalanceError(
            err instanceof Error ? err.message : "Could not load game balance.",
          );
      })
      .finally(() => {
        if (active) setBalanceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showBalance, authToken]);

  useEffect(() => {
    if (!authToken) {
      setMatches([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    void fetchCurrentUserMatches(10)
      .then((rows) => {
        setMatches(rows);
        setError("");
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Failed to load match history.",
        );
      })
      .finally(() => setLoading(false));
  }, [authToken]);

  if (!authToken) {
    return (
      <Screen
        navigation={navigation}
        activeRoute="History"
        title="Recent Matches"
        subtitle="Review the outcomes of your recent games."
      >
        <EmptyState
          title="Sign in to view recent matches."
          description="Sign in with Google to see your account's match history."
          action={
            <Button onPress={() => navigation.navigate("SignIn")}>
              Sign in
            </Button>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      navigation={navigation}
      activeRoute="History"
      title="Recent Matches"
      subtitle="Review the outcomes of your recent games."
    >
      <View className="flex-row gap-2">
        <Button
          variant={!showBalance ? "secondary" : "outline"}
          accessibilityState={{ selected: !showBalance }}
          onPress={() => setShowBalance(false)}
        >
          Recent matches
        </Button>
        <Button
          variant={showBalance ? "secondary" : "outline"}
          accessibilityState={{ selected: showBalance }}
          onPress={() => setShowBalance(true)}
        >
          Game balance
        </Button>
      </View>
      {showBalance ? (
        balanceLoading ? (
          <LoadingCard label="Loading game balance..." />
        ) : balanceError ? (
          <EmptyState
            title="Could not load game balance."
            description={balanceError}
          />
        ) : balance ? (
          <MatchBalanceView balance={balance} />
        ) : null
      ) : (
        <>
          <HistoryContent
            loading={loading}
            error={error}
            matches={matches}
            navigation={navigation}
            onOpenReplay={setSelectedMatch}
          />
          {selectedMatch !== null ? (
            <View className="gap-4 border-t border-border pt-6">
              <Button variant="outline" onPress={() => setSelectedMatch(null)}>
                Close replay
              </Button>
              {replayLoading ? (
                <LoadingCard label="Loading replay..." />
              ) : replayError ? (
                <EmptyState
                  title="Could not load replay."
                  description={replayError}
                />
              ) : replay ? (
                <MatchReplayView replay={replay} />
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
