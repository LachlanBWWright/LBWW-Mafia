import React from "react";
import { Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StackParamList } from "../App";
import { Button, Screen } from "../components/ui";

export function PublicGameLobbyScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, "Lobby">) {
  return (
    <Screen
      navigation={navigation}
      activeRoute="Lobby"
      title="Public lobby"
      subtitle="Join the live public room with chat, votes, visits, and whispers."
    >
      <Text className="text-sm text-muted-foreground">
        The public game is available from the shared Lobby destination.
      </Text>
      <Button onPress={() => navigation.navigate("Lobby")}>
        Join public lobby
      </Button>
    </Screen>
  );
}
