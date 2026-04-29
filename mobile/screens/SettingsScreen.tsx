import React from "react";
import { Text, View } from "react-native";

export function SettingsScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-lg">
      <Text className="text-center text-sm text-muted-foreground">
        Settings are not part of the parity navigation.
      </Text>
    </View>
  );
}
