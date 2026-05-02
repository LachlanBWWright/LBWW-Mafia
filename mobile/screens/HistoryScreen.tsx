import React, { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { StackParamList } from "../App";
import { fetchRecentMatches, type RecentMatchSummary } from "../lib/appQueries";
import { useAppState } from "../context/AppStateContext";
import { Badge, Button, Card, EmptyState, LoadingCard, Screen } from "../components/ui";

type HistoryScreenProps = NativeStackScreenProps<StackParamList, "History">;

function HistoryContent({
  loading,
  error,
  matches,
  navigation,
}: {
  loading: boolean;
  error: string;
  matches: RecentMatchSummary[];
  navigation: any;
}) {
  if (loading) {
    return <LoadingCard label="Loading recent matches..." />;
  }
  if (error) {
    return (
      <EmptyState
        title="Could not load history."
        description={error}
        action={<Button onPress={() => navigation.navigate("Lobby")}>Back to Lobby</Button>}
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
        <Card key={match.id}>
          <View className="gap-2">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-[15px] font-extrabold text-foreground">
                Match #{match.id}
              </Text>
              <Badge variant="secondary">{match.winningFaction} won</Badge>
            </View>
            <Text className="text-xs leading-[18px] text-muted-foreground">
              {new Date(match.endedAt).toLocaleString()} • {match.roomName}
            </Text>
            <Text className="text-xs leading-[18px] text-muted-foreground">
              Winners: {match.winningRoles.join(", ") || "None"} • Events:{" "}
              {match.conversationCount + match.actionCount}
            </Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

export function HistoryScreen({ navigation }: HistoryScreenProps) {
  const { playerName } = useAppState();
  const [matches, setMatches] = useState<RecentMatchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!playerName.trim()) {
      setMatches([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    void fetchRecentMatches(playerName, 10)
      .then((rows) => {
        setMatches(rows);
        setError("");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load match history.");
      })
      .finally(() => setLoading(false));
  }, [playerName]);

  if (!playerName.trim()) {
    return (
      <Screen
        navigation={navigation}
        activeRoute="History"
        title="Recent Matches"
        subtitle="Match history uses the same recentByUsername data source as the web app."
      >
        <EmptyState
          title="No username available for history lookup."
          description="Join the lobby first so the app can use your current player identity."
          action={<Button onPress={() => navigation.navigate("Lobby")}>Join Lobby</Button>}
        />
      </Screen>
    );
  }

  return (
    <Screen
      navigation={navigation}
      activeRoute="History"
      title="Recent Matches"
      subtitle="Match history uses the same recentByUsername data source as the web app."
    >
      <HistoryContent loading={loading} error={error} matches={matches} navigation={navigation} />
    </Screen>
  );
}
