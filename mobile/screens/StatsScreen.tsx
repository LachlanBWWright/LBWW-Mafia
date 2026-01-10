import React from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { api } from "../utils/api";

export function StatsScreen() {
  const { data: stats, isLoading, isError } = api.stats.getPersonalStats.useQuery();

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading stats...</Text>
      </View>
    );
  }

  if (isError || !stats) {
     return (
        <View style={styles.centerContainer}>
           <Text style={styles.errorText}>Failed to load statistics.</Text>
        </View>
     );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Statistics</Text>
      </View>

      <View style={styles.grid}>
        <StatCard label="Total Games" value={stats.totalGames} color="#3B82F6" />
        <StatCard label="Wins" value={stats.totalWins} color="#10B981" />
        <StatCard label="Win Rate" value={`${stats.winRate}%`} color="#8B5CF6" />
      </View>

      <Text style={styles.sectionTitle}>Faction Performance</Text>
      <View style={styles.factionContainer}>
         <FactionRow label="Town" games={stats.townGames} wins={stats.townWins} color="#3B82F6" />
         <FactionRow label="Mafia" games={stats.mafiaGames} wins={stats.mafiaWins} color="#EF4444" />
         <FactionRow label="Neutral" games={stats.neutralGames} wins={stats.neutralWins} color="#F59E0B" />
      </View>

      <Text style={styles.sectionTitle}>Role Breakdown</Text>
      <View style={styles.rolesContainer}>
        {stats.roleStats.map((roleStat) => (
          <View key={roleStat.role} style={styles.roleRow}>
             <Text style={styles.roleName}>{roleStat.role}</Text>
             <Text style={styles.roleCount}>{roleStat.gamesPlayed}</Text>
          </View>
        ))}
        {stats.roleStats.length === 0 && (
            <Text style={styles.emptyText}>No role data yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.cardValue, { color }]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

function FactionRow({ label, games, wins, color }: { label: string; games: number; wins: number; color: string }) {
    const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;
    return (
        <View style={styles.factionRow}>
            <View style={styles.factionLabelContainer}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.factionName}>{label}</Text>
            </View>
            <View style={styles.factionStats}>
                <Text style={styles.factionStatText}>{wins} W / {games} G ({winRate}%)</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  content: {
    padding: 16,
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
  },
  header: {
    marginBottom: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    width: "30%",
  },
  cardValue: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 12,
    marginTop: 8,
  },
  factionContainer: {
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  factionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  factionLabelContainer: {
      flexDirection: "row",
      alignItems: "center",
  },
  dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
  },
  factionName: {
      color: "white",
      fontWeight: "500",
  },
  factionStats: {
      alignItems: "flex-end",
  },
  factionStatText: {
      color: "#D1D5DB",
  },
  rolesContainer: {
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 16,
  },
  roleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: "#374151",
  },
  roleName: {
      color: "white",
  },
  roleCount: {
      color: "#9CA3AF",
  },
  emptyText: {
      color: "#9CA3AF",
      fontStyle: "italic",
      textAlign: "center"
  }
});
