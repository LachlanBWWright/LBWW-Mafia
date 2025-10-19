import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { config } from "../config";

export function SettingsScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Backend Configuration</Text>
        <View style={styles.configItem}>
          <Text style={styles.configLabel}>API Server:</Text>
          <Text style={styles.configValue}>{config.apiUrl}</Text>
        </View>
        <View style={styles.configItem}>
          <Text style={styles.configLabel}>Socket Server:</Text>
          <Text style={styles.configValue}>{config.socketUrl}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.infoText}>
          MERN Mafia - Mobile Edition
        </Text>
        <Text style={styles.infoText}>
          Version 2.0 with tRPC Integration
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Features</Text>
        <Text style={styles.featureItem}>• Create new game sessions</Text>
        <Text style={styles.featureItem}>• Browse active public games</Text>
        <Text style={styles.featureItem}>• Join private games with room codes</Text>
        <Text style={styles.featureItem}>• Real-time gameplay with Socket.IO</Text>
        <Text style={styles.featureItem}>• Type-safe API with tRPC</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.note}>
          Note: Ensure your backend servers (Next.js and Socket.IO) are running 
          and accessible at the configured URLs above.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  section: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  configItem: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  configValue: {
    fontSize: 14,
    color: "#3333FF",
    fontFamily: "monospace",
  },
  infoText: {
    fontSize: 16,
    marginBottom: 8,
    color: "#333",
  },
  featureItem: {
    fontSize: 14,
    marginBottom: 6,
    color: "#555",
  },
  note: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
    backgroundColor: "#fffef0",
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#ffcc00",
  },
});
