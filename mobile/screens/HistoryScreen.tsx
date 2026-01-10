import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { api } from "../utils/api";

type FilterStatus = "FINISHED" | "CANCELLED" | undefined;

export function HistoryScreen() {
  const [filter, setFilter] = useState<{ status?: FilterStatus }>({});

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError
  } = api.match.getHistory.useInfiniteQuery(
    { limit: 20, filter },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const matches = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  if (isError) {
     return (
        <View style={styles.centerContainer}>
           <Text style={styles.errorText}>Failed to load history.</Text>
           <Text style={styles.subText}>Please sign in or try again later.</Text>
        </View>
     );
  }

  const renderFilterButton = (status: FilterStatus, label: string) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter.status === status && styles.filterButtonActive,
      ]}
      onPress={() => setFilter({ status })}
    >
      <Text
        style={[
          styles.filterButtonText,
          filter.status === status && styles.filterButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        {renderFilterButton(undefined, "All")}
        {renderFilterButton("FINISHED", "Finished")}
        {renderFilterButton("CANCELLED", "Cancelled")}
      </View>

      <FlatList
        data={matches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MatchCard match={item} />}
        contentContainerStyle={styles.listContent}
        onEndReached={() => {
          if (hasNextPage) {
            void fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator size="small" color="#3B82F6" style={{ margin: 10 }} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No matches found</Text>
          </View>
        }
      />
    </View>
  );
}

function MatchCard({ match }: { match: any }) {
  const gameDate = new Date(match.joinedAt);
  const isWinner = match.isWinner === true;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
           <Text style={styles.roomCode}>Room: {match.gameSession.roomCode}</Text>
           <Text style={styles.dateText}>{gameDate.toLocaleDateString()} {gameDate.toLocaleTimeString()}</Text>
        </View>
        {match.isWinner !== null && (
          <View
            style={[
              styles.badge,
              isWinner ? styles.badgeSuccess : styles.badgeFailure,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                isWinner ? styles.badgeTextSuccess : styles.badgeTextFailure,
              ]}
            >
              {isWinner ? "Victory" : "Defeat"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.roleText}>Role: {match.role ?? "Unknown"}</Text>
        <Text style={styles.playerCount}>
          {match.gameSession._count?.participants ?? 0} players
        </Text>
      </View>

      {match.gameSession.status === "CANCELLED" && (
        <Text style={styles.cancelledText}>Game was cancelled</Text>
      )}
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
  errorText: {
     color: "#EF4444",
     fontSize: 18,
     fontWeight: "bold"
  },
  subText: {
     color: "#9CA3AF",
     marginTop: 5
  },
  emptyContainer: {
     padding: 20,
     alignItems: 'center'
  },
  emptyText: {
     color: "#9CA3AF",
     fontSize: 16
  },
  filterContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 10,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: "#374151",
  },
  filterButtonActive: {
    backgroundColor: "#2563EB",
  },
  filterButtonText: {
    color: "#9CA3AF",
    fontWeight: "600",
  },
  filterButtonTextActive: {
    color: "white",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  roomCode: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  dateText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  badgeSuccess: {
    backgroundColor: "#064E3B",
  },
  badgeFailure: {
    backgroundColor: "#7F1D1D",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  badgeTextSuccess: {
    color: "#A7F3D0",
  },
  badgeTextFailure: {
    color: "#FECACA",
  },
  cardBody: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roleText: {
    color: "#D1D5DB",
  },
  playerCount: {
    color: "#9CA3AF",
  },
  cancelledText: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    marginTop: 8,
  },
});
