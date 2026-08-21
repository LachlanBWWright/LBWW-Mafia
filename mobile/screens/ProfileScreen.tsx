import React, { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { StackParamList } from "../App";
import { fetchCurrentUserMatches, fetchRecentMatches, type RecentMatchSummary } from "../lib/appQueries";
import { useAppState } from "../context/AppStateContext";
import { Badge, Button, Card, EmptyState, LoadingCard, Screen, SectionHeader } from "../components/ui";

type ProfileScreenProps = NativeStackScreenProps<StackParamList, "Profile">;

function ProfileCard({
  playerName,
  isAdmin,
  lastRoomName,
  navigation,
}: {
  playerName: string;
  isAdmin: boolean;
  lastRoomName: string;
  navigation: ProfileScreenProps["navigation"];
}) {
  return (
    <Card>
      <SectionHeader
        title={playerName}
        subtitle={isAdmin ? "Admin-enabled account" : "Current player identity"}
      />
      <View className="gap-2">
        <Text className="text-sm text-muted-foreground">
          {isAdmin ? "Admin access granted." : "Admin access is not enabled."}
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <Badge variant="secondary">Identity active</Badge>
          <Badge variant="outline">Room {lastRoomName}</Badge>
          {isAdmin ? (
            <Badge variant="destructive">Admin</Badge>
          ) : (
            <Badge variant="outline">Player</Badge>
          )}
        </View>
        {isAdmin && (
          <Button
            variant="secondary"
            size="sm"
            onPress={() => navigation.navigate("Admin")}
          >
            Open Admin Page
          </Button>
        )}
      </View>
    </Card>
  );
}

function MatchesContent({
  loading,
  matches,
}: {
  loading: boolean;
  matches: RecentMatchSummary[];
}) {
  if (loading) {
    return <LoadingCard label="Loading your recent matches..." />;
  }
  if (matches.length === 0) {
    return (
      <EmptyState
        title="No recent matches yet."
        description="Play a game to populate your profile history."
      />
    );
  }
  return (
    <Card>
      <SectionHeader title="Your Recent Matches" />
      <View className="gap-2.5">
        {matches.map((match) => (
          <View key={match.id} className="gap-1">
            <Text className="text-sm font-extrabold text-foreground">
              Match #{match.id} • {match.winningFaction} won
            </Text>
            <Text className="text-xs leading-[18px] text-muted-foreground">
              {new Date(match.endedAt).toLocaleString()} • {match.roomName}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { playerName, isAdmin, lastRoomName, authToken } = useAppState();
  const [matches, setMatches] = useState<RecentMatchSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!playerName.trim()) {
      setMatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void (authToken ? fetchCurrentUserMatches(5) : fetchRecentMatches(playerName, 5))
      .then((rows) => setMatches(rows))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [authToken, playerName]);

  if (!playerName.trim()) {
    return (
      <Screen
        navigation={navigation}
        activeRoute="Profile"
        title="Profile"
        subtitle="Signed-out state, current identity, recent matches, and admin entry point."
      >
        <EmptyState
          title="Sign in to view your profile and match history."
          description="Use your LBWW Mafia account to see your identity and recent games."
          action={<Button onPress={() => navigation.navigate("SignIn")}>Sign in</Button>}
        />
      </Screen>
    );
  }

  return (
    <Screen
      navigation={navigation}
      activeRoute="Profile"
      title="Profile"
      subtitle="Signed-out state, current identity, recent matches, and admin entry point."
    >
      <View className="gap-4">
        <ProfileCard
          playerName={playerName}
          isAdmin={isAdmin}
          lastRoomName={lastRoomName}
          navigation={navigation}
        />
        <MatchesContent loading={loading} matches={matches} />
      </View>
    </Screen>
  );
}
