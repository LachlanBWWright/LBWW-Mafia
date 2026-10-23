import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  AccountNotification,
  LobbyInvitation,
} from "../../shared/trpc/accountFeatures";
import type { StackParamList } from "../App";
import { Button, Screen } from "../components/ui";
import { trpcClient } from "../lib/trpc";
import { useAppState } from "../context/AppStateContext";
import { runInForeground } from "../lib/foreground";

export function NotificationsView({
  items,
  invitations,
  busy,
  showTitle = true,
  onRead,
  onRespond,
  onOpen,
}: {
  items: AccountNotification[];
  invitations: LobbyInvitation[];
  busy?: boolean;
  showTitle?: boolean;
  onRead: (id?: number) => void;
  onRespond: (id: number, accept: boolean) => void;
  onOpen: (item: AccountNotification) => void;
}) {
  return (
    <View className="gap-4">
      {showTitle ? (
        <Text className="text-2xl font-semibold text-foreground">
          Notifications
        </Text>
      ) : null}
      <Button
        variant="outline"
        disabled={busy || !items.some((item) => !item.readAt)}
        onPress={() => onRead()}
      >
        Mark all read
      </Button>
      {invitations
        .filter((invite) => invite.status === "pending")
        .map((invite) => (
          <View key={invite.id} className="border-b border-border py-3 gap-2">
            <Text className="text-foreground">
              {invite.senderName ?? "A friend"} invited you to lobby{" "}
              {invite.roomId}.
            </Text>
            <View className="flex-row flex-wrap gap-2">
              <Button
                disabled={busy}
                onPress={() => onRespond(invite.id, true)}
              >
                Accept and join
              </Button>
              <Button
                disabled={busy}
                variant="outline"
                onPress={() => onRespond(invite.id, false)}
              >
                Decline
              </Button>
            </View>
          </View>
        ))}
      {!items.length ? (
        <Text className="text-muted-foreground">No notifications yet.</Text>
      ) : null}
      {items.map((item) => (
        <View key={item.id} className="border-b border-border py-3 gap-2">
          <Button variant="ghost" onPress={() => onOpen(item)}>
            {item.actorName ?? "A player"}
            {item.category === "message"
              ? " sent you a message."
              : item.category === "friend_request"
                ? " sent a friend request."
                : " invited you to a lobby."}
          </Button>
          <Text className="text-xs text-muted-foreground">
            {item.createdAt.toLocaleString()}
          </Text>
          {!item.readAt ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onPress={() => onRead(item.id)}
            >
              Mark read
            </Button>
          ) : null}
        </View>
      ))}
    </View>
  );
}
export function NotificationsScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, "Notifications">) {
  const { authToken } = useAppState();
  const tokenRef = useRef(authToken);
  tokenRef.current = authToken;
  const [loadedToken, setLoadedToken] = useState<string | null>(null);
  const [items, setItems] = useState<AccountNotification[]>([]);
  const [invitations, setInvitations] = useState<LobbyInvitation[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const requestToken = authToken;
    if (!requestToken) return;
    try {
      const [notifications, invites] = await Promise.all([
        trpcClient.features.inbox.query(),
        trpcClient.features.invitations.query(),
      ]);
      if (tokenRef.current !== requestToken) return;
      setLoadedToken(requestToken);
      setItems(notifications);
      setInvitations(invites);
      setError("");
    } catch {
      if (tokenRef.current !== requestToken) return;
      setError("Unable to load notifications. Please try again.");
    }
  }, [authToken]);
  useEffect(() => {
    if (!authToken) return;
    return runInForeground(() => void load(), 15000);
  }, [authToken, load]);
  async function read(id?: number) {
    setBusy(true);
    try {
      await trpcClient.features.markRead.mutate({ id });
      await load();
    } catch {
      setError("Unable to mark notifications read.");
    } finally {
      setBusy(false);
    }
  }
  async function respond(id: number, accept: boolean) {
    setBusy(true);
    try {
      const result = await trpcClient.features.respondInvitation.mutate({
        id,
        accept,
      });
      if (result.roomId)
        navigation.navigate("Lobby", { roomId: result.roomId });
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to respond to invitation.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      navigation={navigation}
      activeRoute="Notifications"
      title="Notifications"
    >
      {authToken ? (
        <>
          <NotificationsView
            showTitle={false}
            items={loadedToken === authToken ? items : []}
            invitations={loadedToken === authToken ? invitations : []}
            busy={busy}
            onRead={(id) => void read(id)}
            onRespond={(id, accept) => void respond(id, accept)}
            onOpen={(item) => {
              void read(item.id);
              if (item.category === "message") navigation.navigate("Messages");
              else if (item.category === "friend_request")
                navigation.navigate("Community");
              else navigation.navigate("Notifications");
            }}
          />
          {error ? (
            <View className="gap-2">
              <Text
                accessibilityLiveRegion="polite"
                className="text-destructive"
              >
                {error}
              </Text>
              <Button variant="outline" onPress={() => void load()}>
                Retry
              </Button>
            </View>
          ) : null}
        </>
      ) : (
        <Button onPress={() => navigation.navigate("SignIn")}>Sign in</Button>
      )}
    </Screen>
  );
}
