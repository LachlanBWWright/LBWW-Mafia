import React from "react";
import { Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StackParamList } from "../App";
import { Button, Screen } from "../components/ui";

export function PrivateGameLobbyScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, "Lobby">) {
  return (
    <Screen
      navigation={navigation}
      activeRoute="Lobby"
      title="Private lobby"
      subtitle="Private rooms use the same live lobby and game surface."
    >
      <Text className="text-sm text-muted-foreground">
        Enter a room from Create Lobby or use the shared lobby link.
      </Text>
      <Button onPress={() => navigation.navigate("CreateLobby")}>
        Create private lobby
      </Button>
    </Screen>
  );
}
