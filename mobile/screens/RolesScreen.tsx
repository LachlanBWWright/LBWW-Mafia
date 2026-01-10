import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { roles } from "../constants/roles";

const rolesList = Array.from(roles.entries()).map(([name, description]) => ({
  name,
  description,
}));

export function RolesScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={rolesList}
        keyExtractor={(item) => item.name}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.roleName}>{item.name}</Text>
            <Text style={styles.roleDescription}>{item.description}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827", // gray-900 equivalent
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: "#1F2937", // gray-800 equivalent
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  roleName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  roleDescription: {
    fontSize: 14,
    color: "#D1D5DB", // gray-300 equivalent
    lineHeight: 20,
  },
});
