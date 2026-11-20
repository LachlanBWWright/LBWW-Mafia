import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { StackParamList } from "../App";
import { createUsePublicLobbies } from "../../shared/game/usePublicLobbies";
import { runInForeground } from "../lib/foreground";
import { Button, Input, Screen } from "../components/ui";
const base =
  process.env.EXPO_PUBLIC_TRPC_URL?.replace(/\/api\/trpc\/?$/, "") ??
  "http://localhost:3000";
const usePublicLobbies = createUsePublicLobbies({
  useState,
  useEffect,
  useRef,
  useCallback,
});
const subscribe = (refresh: () => void) => runInForeground(refresh, 15000);
export function PublicLobbiesScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, "PublicLobbies">) {
  const { lobbies, next, status, load } = usePublicLobbies(base, subscribe);
  const [query, setQuery] = useState("");
  const [joinable, setJoinable] = useState(false);
  const [seats, setSeats] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const visible = lobbies.filter(
    (lobby) =>
      lobby.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!joinable ||
        (lobby.status === "waiting" && lobby.players < lobby.capacity)) &&
      lobby.capacity - lobby.players >= seats,
  );
  return (
    <Screen
      navigation={navigation}
      activeRoute="PublicLobbies"
      title="Public lobbies"
    >
      <View className="gap-4">
        <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1"><Input
          accessibilityLabel="Search lobbies"
          placeholder="Search lobbies…"
          value={query}
          onChangeText={setQuery}
        /></View>
        <Button size="sm" variant="outline" onPress={() => setFiltersOpen(!filtersOpen)} accessibilityState={{ expanded: filtersOpen }}>
          {joinable || seats ? "Filters •" : "Filters"}
        </Button>
        <Button size="sm" variant="ghost" onPress={() => void load()} disabled={status === "loading"}>Refresh</Button>
        </View>
        {filtersOpen ? <View className="gap-2">
        <Button
          variant="outline"
          accessibilityState={{ checked: joinable }}
          onPress={() => setJoinable(!joinable)}
        >
          {joinable ? "Joinable only: on" : "Joinable only: off"}
        </Button>
        <Text className="text-foreground">Open seats</Text>
        <View className="flex-row flex-wrap gap-2">
          {[0, 1, 2, 4].map((count) => (
            <Button
              key={count}
              size="sm"
              variant={seats === count ? "primary" : "outline"}
              accessibilityState={{ selected: seats === count }}
              onPress={() => setSeats(count)}
            >
              {count ? `${count}+` : "Any"}
            </Button>
          ))}
        </View>
        </View> : null}
        {status === "loading" && !lobbies.length ? (
          <Text accessibilityLiveRegion="polite">Loading lobbies…</Text>
        ) : status === "error" ? (
          <Text accessibilityRole="alert">
            Unable to load public lobbies. Try refreshing.
          </Text>
        ) : visible.length === 0 ? (
          <Text className="text-muted-foreground">
            No matching lobbies in these results.
          </Text>
        ) : (
          visible.map((lobby) => (
            <View
              key={lobby.roomId}
              className="flex-row items-center justify-between gap-4 border-b border-border py-4"
            >
              <View className="min-w-0 flex-1">
                <Text className="font-semibold text-foreground">
                  {lobby.name}
                </Text>
                <Text className="text-sm text-muted-foreground">
                  ({lobby.players}/{lobby.capacity}) ·{" "}
                  {lobby.status === "waiting"
                    ? "Waiting"
                    : lobby.status === "in-progress"
                      ? "In progress"
                      : "Finished"}
                </Text>
              </View>
              {lobby.status === "waiting" && lobby.players < lobby.capacity ? (
                <Button
                  onPress={() =>
                    navigation.navigate("Lobby", { roomId: lobby.roomId })
                  }
                >
                  Join
                </Button>
              ) : null}
            </View>
          ))
        )}
        {next !== null ? (
          <Button
            variant="outline"
            disabled={status === "loading"}
            onPress={() => void load(next)}
          >
            Load more
          </Button>
        ) : null}
      </View>
    </Screen>
  );
}
