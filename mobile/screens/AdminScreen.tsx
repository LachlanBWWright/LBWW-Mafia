import React, { useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { StackParamList } from "../App";
import { searchUsers, setUserAdmin, type UserSummary } from "../lib/appQueries";
import { useAppState } from "../context/AppStateContext";
import { Badge, Button, Card, EmptyState, Input, Screen, SectionHeader } from "../components/ui";

type AdminScreenProps = NativeStackScreenProps<StackParamList, "Admin">;

function AdminContent({
  users,
  toggleAdmin,
}: {
  users: UserSummary[];
  toggleAdmin: (user: UserSummary) => void;
}) {
  return (
    <View className="gap-2.5">
      {users.map((user) => (
        <Card key={user.id}>
          <View className="gap-2">
            <View className="flex-row justify-between gap-2">
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-extrabold text-foreground">
                  {user.name ?? "Unnamed user"}
                </Text>
                <Text className="text-xs text-muted-foreground">
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
  );
}

function SearchCard({
  query,
  setQuery,
  runSearch,
  searching,
  status,
}: {
  query: string;
  setQuery: (q: string) => void;
  runSearch: () => void;
  searching: boolean;
  status: string;
}) {
  return (
    <Card>
      <SectionHeader title="Admin User Search" />
      <View className="gap-2.5">
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name or email"
        />
        <Button onPress={runSearch} disabled={searching}>
          {searching ? "Searching..." : "Search"}
        </Button>
        {status ? (
          <Text className="text-xs text-muted-foreground">
            {status}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

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

  if (!isAdmin) {
    return (
      <Screen
        navigation={navigation}
        activeRoute="Admin"
        title="Admin"
        subtitle="User search and admin toggles are available only to authorized users."
      >
        <EmptyState
          title="You are not authorized."
          description="Sign in with an administrator account to manage users."
        />
      </Screen>
    );
  }

  return (
    <Screen
      navigation={navigation}
      activeRoute="Admin"
      title="Admin"
      subtitle="User search and admin toggles are available only to authorized users."
    >
      <View className="gap-4">
        <SearchCard
          query={query}
          setQuery={setQuery}
          runSearch={runSearch}
          searching={searching}
          status={status}
        />
        <AdminContent users={users} toggleAdmin={toggleAdmin} />
      </View>
    </Screen>
  );
}
