import React from "react";
import { Text, View } from "react-native";

export function PrivateGameLobbyScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-lg">
      <Text className="text-center text-sm text-muted-foreground">
        Private games are folded into the main lobby flow.
      </Text>
    </View>
  );
}
