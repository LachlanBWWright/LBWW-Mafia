import React, { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { StackParamList } from "../App";
import { fetchRecentMatches, type RecentMatchSummary } from "../lib/appQueries";
import { useAppState } from "../context/AppStateContext";
import { Badge, Button, Card, EmptyState, LoadingCard, Screen } from "../components/ui";
import { colors } from "../styles/colors";

type HistoryScreenProps = NativeStackScreenProps<StackParamList, "History">;

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

  return (
    <Screen
      navigation={navigation}
      activeRoute="History"
      title="Recent Matches"
      subtitle="Match history uses the same recentByUsername data source as the web app."
    >
      {!playerName.trim() ? (
        <EmptyState
          title="No username available for history lookup."
          description="Join the lobby first so the app can use your current player identity."
          action={<Button onPress={() => navigation.navigate("Lobby")}>Join Lobby</Button>}
        />
      ) : loading ? (
        <LoadingCard label="Loading recent matches..." />
      ) : error ? (
        <EmptyState title="Could not load history." description={error} action={<Button onPress={() => navigation.navigate("Lobby")}>Back to Lobby</Button>} />
      ) : matches.length === 0 ? (
        <EmptyState title="No recent matches found." description="This player has no match history yet." />
      ) : (
        <View style={{ gap: 12 }}>
          {matches.map((match) => (
            <Card key={match.id}>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>
                    Match #{match.id}
                  </Text>
                  <Badge variant="secondary">{match.winningFaction} won</Badge>
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
                  {new Date(match.endedAt).toLocaleString()} • {match.roomName}
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
                  Winners: {match.winningRoles.join(", ") || "None"} • Events:{" "}
                  {match.conversationCount + match.actionCount}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
