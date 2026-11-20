import React from "react";
import { Text, View } from "react-native";
import { Button } from "./ui";

type LandingContentProps = {
  onJoin: () => void;
  onPublicLobbies: () => void;
  onCreate: () => void;
};
export function LandingContent({
  onJoin,
  onPublicLobbies,
  onCreate,
}: LandingContentProps) {
  return (
    <View className="gap-8 py-5">
      <View className="gap-5">
        <Text
          accessibilityRole="header"
          className="text-5xl font-black leading-[48px] tracking-[-2px] text-foreground"
        >
          LBWW Mafia
        </Text>
        <View className="flex-row flex-wrap gap-3">
          <Button size="lg" onPress={onJoin}>
            Quick Join
          </Button>
          <Button size="lg" variant="outline" onPress={onCreate}>
            Create Lobby
          </Button>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Button variant="ghost" onPress={onPublicLobbies}>
            Public Lobbies
          </Button>
        </View>
      </View>
    </View>
  );
}
