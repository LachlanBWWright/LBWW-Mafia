import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { authenticatedFetch } from "../lib/mobileSession";
import { createUseLobbyInvites } from "../../shared/game/useLobbyInvites";
import { runInForeground } from "../lib/foreground";
import { trpcClient } from "../lib/trpc";
import { Button, Input } from "./ui";
const useLobbyInvites = createUseLobbyInvites({
  useState,
  useEffect,
  useCallback,
  useRef,
});
const subscribe = (refresh: () => void) => runInForeground(refresh, 15000);
export function LobbyInvites({
  roomId,
  authToken,
  onClosed,
}: {
  roomId: string;
  authToken: string;
  onClosed: () => void;
}) {
  const { isHost, friends, sent, error, busy, invite } = useLobbyInvites(
    trpcClient,
    roomId,
    subscribe,
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [closeError, setCloseError] = useState("");
  const [closing, setClosing] = useState(false);
  const closeLobby = () =>
    Alert.alert("Close lobby?", "This closes the lobby for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close lobby",
        style: "destructive",
        onPress: () => {
          setClosing(true);
          setCloseError("");
          const base =
            process.env.EXPO_PUBLIC_TRPC_URL?.replace(/\/api\/trpc\/?$/, "") ??
            "http://localhost:3000";
          void authenticatedFetch(
            `${base}/api/lobbies/${encodeURIComponent(roomId)}`,
            {
              method: "DELETE",
              headers: { authorization: `Bearer ${authToken}` },
            },
          )
            .then((response) => {
              if (!response.ok) throw new Error();
              onClosed();
            })
            .catch(() => {
              setCloseError("Unable to close lobby. Try again.");
              setClosing(false);
            });
        },
      },
    ]);
  if (!isHost) return null;
  const visible = friends.filter((friend) =>
    `${friend.name ?? ""} ${friend.handle ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <View className="gap-2 border-b border-border py-2">
      <View className="flex-row flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(!open)}
        >
          Invite friends
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={closing}
          onPress={closeLobby}
        >
          {closing ? "Closing…" : "Close lobby"}
        </Button>
      </View>
      {closeError ? <Text accessibilityRole="alert">{closeError}</Text> : null}
      {open ? (
        <View className="gap-2">
          <Input
            accessibilityLabel="Find friends"
            placeholder="Find friends…"
            value={query}
            onChangeText={setQuery}
          />
          {error ? <Text accessibilityRole="alert">{error}</Text> : null}
          {!visible.length ? (
            <Text className="text-muted-foreground">No friends found.</Text>
          ) : null}
          {visible.map((friend) => {
            const latest = sent.find((item) => item.recipientId === friend.id);
            const status = latest?.status;
            return (
              <View
                key={friend.id}
                className="flex-row items-center justify-between gap-2"
              >
                <Text className="flex-1 text-foreground">
                  {friend.name ?? friend.handle ?? "Player"}
                </Text>
                {status === "pending" || status === "accepted" ? (
                  <Text className="text-muted-foreground">
                    {status === "accepted" ? "Accepted" : "Sent"}
                  </Text>
                ) : (
                  <Button
                    size="sm"
                    disabled={!!busy}
                    onPress={() => void invite(friend.id)}
                  >
                    {busy === friend.id ? "Sending…" : "Invite"}
                  </Button>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
