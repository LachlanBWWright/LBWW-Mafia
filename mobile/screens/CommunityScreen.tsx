import { LobbyGroupPanel } from "../components/LobbyGroupPanel";
import { PlayerAvatar } from "../components/PlayerAvatar";
import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SocialUser } from "../../shared/trpc/appRouter";
import { StackParamList } from "../App";
import { Button, Card, Input, Screen } from "../components/ui";
import { PlayerReports } from "../components/PlayerReports";
import { ReportPlayer } from "../components/ReportPlayer";
import { trpcClient } from "../lib/trpc";

type Props = NativeStackScreenProps<StackParamList, "Community">;

export function CommunityScreen({ navigation }: Props) {
  const [inviteUser, setInviteUser] = useState<SocialUser | null>(null);
  const [hostedRooms, setHostedRooms] = useState<
    { roomId: string; name?: string }[]
  >([]);
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SocialUser[]>([]);
  const [connections, setConnections] = useState<SocialUser[]>([]);
  const [moreUser, setMoreUser] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [found, friends] = await Promise.all([
        trpcClient.social.search.query({ query }),
        trpcClient.social.friends.query(),
      ]);
      setUsers(found);
      setConnections(friends);
      setError("");
    } catch {
      setError("Unable to load players.");
    }
  }, [query]);
  useEffect(() => {
    void trpcClient.features.hostedLobbies
      .query()
      .then(setHostedRooms)
      .catch(() => undefined);
    void load();
  }, [load]);
  async function act(
    user: SocialUser,
    action: "request" | "respond" | "remove" | "block",
  ) {
    try {
      if (action === "request")
        await trpcClient.social.request.mutate({ userId: user.id });
      if (action === "respond")
        await trpcClient.social.respond.mutate({
          userId: user.id,
          accept: true,
        });
      if (action === "remove")
        await trpcClient.social.remove.mutate({ userId: user.id });
      if (action === "block")
        await trpcClient.social.block.mutate({ userId: user.id });
      await load();
    } catch {
      setError("Unable to update this relationship.");
    }
  }
  async function invite() {
    if (!inviteUser) return;
    setBusy(true);
    try {
      const roomId = room.trim();
      await trpcClient.features.invite.mutate({
        recipientId: inviteUser.id,
        roomId,
      });
      setInviteUser(null);
      setError("");
      setStatus("Invitation sent.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to send invitation.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      navigation={navigation}
      activeRoute="Community"
      title="Community"
      subtitle="Find players, manage friends, and see online activity."
    >
      <Card>
        <View className="gap-2">
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search names or handles"
            returnKeyType="search"
          />
          <Button size="sm" onPress={() => void load()}>
            Search
          </Button>
        </View>
        {status ? (
          <Text
            accessibilityLiveRegion="polite"
            className="text-sm text-foreground"
          >
            {status}
          </Text>
        ) : null}
        {error ? (
          <Text className="text-sm text-destructive">{error}</Text>
        ) : null}
        {[
          {
            title: "Friend requests",
            people: connections.filter(
              (user) => user.relationship === "incoming",
            ),
            empty: "No pending friend requests.",
          },
          {
            title: "Friends",
            people: connections.filter(
              (user) => user.relationship === "friend",
            ),
            empty: "No friends yet.",
          },
          ...(query.trim()
            ? [
                {
                  title: "Search results",
                  people: users.filter(
                    (user) =>
                      user.relationship !== "friend" &&
                      user.relationship !== "incoming",
                  ),
                  empty: "No players found.",
                },
              ]
            : []),
        ].map((group) => (
          <View key={group.title} className="gap-2">
            <Text className="font-semibold text-foreground">{group.title}</Text>
            {group.people.length === 0 ? (
              <Text className="text-muted-foreground">{group.empty}</Text>
            ) : null}
            {group.people.map((user) => (
              <View key={user.id} className="gap-2 border-b border-border py-3">
                <View className="flex-row items-center gap-2">
                <PlayerAvatar name={user.name ?? "Player"} preset={user.avatarPreset} />
                <Text className="font-semibold text-foreground">
                  {user.name ?? "Player"} ·{" "}
                  {user.isOnline ? "Online" : "Offline"}
                </Text>
                </View>
                <Text className="text-xs text-muted-foreground">
                  {user.handle ? `@${user.handle} · ` : ""}
                  {user.relationship}
                </Text>
                <View className="flex-row flex-wrap gap-1">
                  {user.relationship === "friend" ? (
                    <Button size="sm" onPress={() => setInviteUser(user)}>
                      Invite
                    </Button>
                  ) : null}

                  {user.relationship === "none" ? (
                    <Button size="sm" onPress={() => void act(user, "request")}>
                      Add
                    </Button>
                  ) : null}
                  {user.relationship === "incoming" ? (
                    <Button size="sm" onPress={() => void act(user, "respond")}>
                      Accept
                    </Button>
                  ) : null}
                  {user.relationship === "friend" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() =>
                        navigation.navigate("Messages", { userId: user.id })
                      }
                    >
                      Message
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    accessibilityState={{ expanded: moreUser === user.id }}
                    onPress={() =>
                      setMoreUser(moreUser === user.id ? "" : user.id)
                    }
                  >
                    More
                  </Button>
                  {moreUser === user.id ? (
                    <View className="flex-row flex-wrap gap-1">
                      <ReportPlayer
                        userId={user.id}
                        name={user.name ?? "Player"}
                      />
                      {user.relationship === "friend" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onPress={() => void act(user, "remove")}
                        >
                          Remove friend
                        </Button>
                      ) : null}
                      {user.relationship !== "blocked" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => void act(user, "block")}
                        >
                          Block
                        </Button>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ))}
        {inviteUser ? (
          <View className="gap-2">
            <Text className="font-semibold text-foreground">
              Invite {inviteUser.name ?? "player"}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {hostedRooms.map((item) => (
                <Button
                  key={item.roomId}
                  size="sm"
                  variant={room === item.roomId ? "primary" : "outline"}
                  onPress={() => setRoom(item.roomId)}
                >
                  {item.name ?? "Private lobby"}
                </Button>
              ))}
            </View>
            {!hostedRooms.length ? (
              <Text className="text-muted-foreground">
                Create a lobby before inviting friends.
              </Text>
            ) : null}
            <Button
              disabled={busy || !room.trim()}
              onPress={() => void invite()}
            >
              {busy ? "Sending…" : "Send invitation"}
            </Button>
            <Button variant="outline" onPress={() => setInviteUser(null)}>
              Cancel
            </Button>
          </View>
        ) : null}
      </Card>
      <LobbyGroupPanel
        onFollowRoom={(roomId) => navigation.navigate("Lobby", { roomId })}
      />
      <PlayerReports />
    </Screen>
  );
}
