import React, { useState } from "react";
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { api } from "../utils/api";

type LeaderboardType = "wins" | "games" | "winRate";

export function LeaderboardScreen() {
  const [type, setType] = useState<LeaderboardType>("wins");

  const { data: leaderboard, isLoading } = api.stats.getLeaderboard.useQuery({
    type,
    limit: 50,
  });

  const renderFilterButton = (filterType: LeaderboardType, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        type === filterType && styles.filterButtonActive,
      ]}
      onPress={() => setType(filterType)}
    >
      <Text
        style={[
          styles.filterButtonText,
          type === filterType && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        {renderFilterButton("wins", "Wins")}
        {renderFilterButton("games", "Games")}
        {renderFilterButton("winRate", "Win Rate")}
      </View>

      <FlatList
        data={leaderboard ?? []}
        keyExtractor={(item) => item.user.id}
        renderItem={({ item, index }) => (
            <LeaderboardEntry entry={item} type={type} highlight={index < 3} />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No data available</Text>
            </View>
        }
      />
    </View>
  );
}

function LeaderboardEntry({
  entry,
  type,
  highlight
}: {
  entry: any;
  type: LeaderboardType;
  highlight: boolean;
}) {
  const rankColors = ["#FBBF24", "#D1D5DB", "#D97706"]; // Gold, Silver, Bronze

  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <View style={styles.rankContainer}>
        <Text style={[styles.rankText, entry.rank <= 3 && { color: rankColors[entry.rank - 1] }]}>
           {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : `#${entry.rank}`}
        </Text>
      </View>

      <Image
        source={{ uri: entry.user.image ?? "https://via.placeholder.com/48" }}
        style={styles.avatar}
      />

      <View style={styles.infoContainer}>
        <Text style={styles.nameText} numberOfLines={1}>
            {entry.user.name ?? "Anonymous"}
        </Text>
      </View>

      <View style={styles.statsContainer}>
         {type === "wins" && (
            <Text style={styles.primaryStat}>{entry.gamesWon} wins</Text>
         )}
         {type === "games" && (
            <Text style={[styles.primaryStat, { color: "#60A5FA" }]}>{entry.gamesPlayed} games</Text>
         )}
         {type === "winRate" && (
            <Text style={[styles.primaryStat, { color: "#A78BFA" }]}>{entry.winRate}%</Text>
         )}
         <Text style={styles.secondaryStat}>
            {entry.gamesPlayed} G • {entry.gamesWon} W
         </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111827",
  },
  loadingText: {
    color: "white",
    marginTop: 10,
  },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#374151",
  },
  filterButtonActive: {
    backgroundColor: "#2563EB",
  },
  filterButtonText: {
    color: "#9CA3AF",
    fontWeight: "600",
    fontSize: 12
  },
  filterButtonTextActive: {
    color: "white",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
     padding: 20,
     alignItems: 'center'
  },
  emptyText: {
     color: "#9CA3AF",
     fontSize: 16
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  cardHighlight: {
     borderColor: "#3B82F6",
     borderWidth: 1
  },
  rankContainer: {
    width: 40,
    alignItems: "center",
  },
  rankText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#9CA3AF",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 12,
    backgroundColor: "#374151"
  },
  infoContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  statsContainer: {
    alignItems: "flex-end",
  },
  primaryStat: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#34D399", // Green
  },
  secondaryStat: {
    fontSize: 10,
    color: "#6B7280",
  },
});
