import React from "react";
import { Text, View } from "react-native";

export function PublicGameLobbyScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-lg">
      <Text className="text-center text-sm text-muted-foreground">
        Public lobby is now the main Lobby screen.
      </Text>
    </View>
  );
}
