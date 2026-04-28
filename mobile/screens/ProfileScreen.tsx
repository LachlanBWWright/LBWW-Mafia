import React, { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { StackParamList } from "../App";
import { fetchRecentMatches, type RecentMatchSummary } from "../lib/appQueries";
import { useAppState } from "../context/AppStateContext";
import { Badge, Button, Card, EmptyState, LoadingCard, Screen, SectionHeader } from "../components/ui";
import { colors } from "../styles/colors";

type ProfileScreenProps = NativeStackScreenProps<StackParamList, "Profile">;

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { playerName, isAdmin, lastRoomName } = useAppState();
  const [matches, setMatches] = useState<RecentMatchSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerName.trim()) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetchRecentMatches(playerName, 5)
      .then((rows) => setMatches(rows))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [playerName]);

  return (
    <Screen
      navigation={navigation}
      activeRoute="Profile"
      title="Profile"
      subtitle="Signed-out state, current identity, recent matches, and admin entry point."
    >
      {!playerName.trim() ? (
        <EmptyState
          title="Sign in to view your profile and match history."
          description="Mobile currently tracks the active player identity from the lobby join flow."
          action={<Button onPress={() => navigation.navigate("Lobby")}>Join Lobby</Button>}
        />
      ) : (
        <View style={{ gap: 16 }}>
          <Card>
            <SectionHeader title={playerName} subtitle={isAdmin ? "Admin-enabled account" : "Current player identity"} />
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
                {isAdmin ? "Admin access granted." : "Admin access is not enabled."}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Badge variant="secondary">Identity active</Badge>
                <Badge variant="outline">Room {lastRoomName}</Badge>
                {isAdmin ? <Badge variant="destructive">Admin</Badge> : <Badge variant="outline">Player</Badge>}
              </View>
              {isAdmin ? (
                <Button variant="secondary" size="sm" onPress={() => navigation.navigate("Admin")}>
                  Open Admin Page
                </Button>
              ) : null}
            </View>
          </Card>

          {loading ? (
            <LoadingCard label="Loading your recent matches..." />
          ) : matches.length === 0 ? (
            <EmptyState
              title="No recent matches yet."
              description="Play a game to populate your profile history."
            />
          ) : (
            <Card>
              <SectionHeader title="Your Recent Matches" />
              <View style={{ gap: 10 }}>
                {matches.map((match) => (
                  <View key={match.id} style={{ gap: 4 }}>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "800" }}>
                      Match #{match.id} • {match.winningFaction} won
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
                      {new Date(match.endedAt).toLocaleString()} • {match.roomName}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </View>
      )}
    </Screen>
  );
}
