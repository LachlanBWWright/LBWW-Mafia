import React, { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { StackParamList } from "../App";
import { searchUsers, setUserAdmin, type UserSummary } from "../lib/appQueries";
import { useAppState } from "../context/AppStateContext";
import { Badge, Button, Card, EmptyState, Input, Screen, SectionHeader } from "../components/ui";
import { colors } from "../styles/colors";

type AdminScreenProps = NativeStackScreenProps<StackParamList, "Admin">;

export function AdminScreen({ navigation }: AdminScreenProps) {
  const { isAdmin } = useAppState();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Run a search to view users.");
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [searching, setSearching] = useState(false);

  const runSearch = async () => {
    setSearching(true);
    setStatus("Searching users...");
    try {
      const result = await searchUsers(query, 50);
      setUsers(result);
      setStatus(result.length === 0 ? "No users found." : "");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Failed to search users.");
    } finally {
      setSearching(false);
    }
  };

  const toggleAdmin = async (user: UserSummary) => {
    try {
      await setUserAdmin(user.id, !user.isAdmin);
      setUsers((current) =>
        current.map((entry) =>
          entry.id === user.id ? { ...entry, isAdmin: !entry.isAdmin } : entry,
        ),
      );
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Failed to update admin role.");
    }
  };

  return (
    <Screen
      navigation={navigation}
      activeRoute="Admin"
      title="Admin"
      subtitle="User search and admin toggles are available only to authorized users."
    >
      {!isAdmin ? (
        <EmptyState
          title="You are not authorized."
          description="The mobile app does not yet have the same authenticated session exchange as the web app."
        />
      ) : (
        <View style={{ gap: 16 }}>
          <Card>
            <SectionHeader title="Admin User Search" />
            <View style={{ gap: 10 }}>
              <Input
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or email"
              />
              <Button onPress={runSearch} disabled={searching}>
                {searching ? "Searching..." : "Search"}
              </Button>
              {status ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  {status}
                </Text>
              ) : null}
            </View>
          </Card>

          <View style={{ gap: 10 }}>
            {users.map((user) => (
              <Card key={user.id}>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>
                        {user.name ?? "Unnamed user"}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                        {user.email}
                      </Text>
                    </View>
                    <Badge variant={user.isAdmin ? "destructive" : "secondary"}>
                      {user.isAdmin ? "Admin" : "Player"}
                    </Badge>
                  </View>
                  <Button
                    variant={user.isAdmin ? "destructive" : "secondary"}
                    onPress={() => toggleAdmin(user)}
                  >
                    {user.isAdmin ? "Revoke admin" : "Make admin"}
                  </Button>
                </View>
              </Card>
            ))}
          </View>
        </View>
      )}
    </Screen>
  );
}
