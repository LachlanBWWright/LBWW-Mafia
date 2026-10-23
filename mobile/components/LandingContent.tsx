import React from "react";
import { Text, View } from "react-native";
import { landingExample } from "../../shared/game/landingExample";
import { Button } from "./ui";

type LandingContentProps = { onJoin: () => void; onCreate: () => void };

export function LandingContent({ onJoin, onCreate }: LandingContentProps) {
  return (
    <View className="flex-1 gap-8 py-6">
      <View className="gap-4">
        <Text
          accessibilityRole="header"
          className="text-[48px] font-black leading-[52px] tracking-[-2px] text-foreground"
        >
          LBWW Mafia
        </Text>
        <Text className="text-base leading-6 text-muted-foreground">
          {landingExample.description}
        </Text>
        <View className="flex-row flex-wrap gap-3">
          <Button size="lg" onPress={onJoin}>
            Join Game
          </Button>
          <Button size="lg" variant="outline" onPress={onCreate}>
            Create Lobby
          </Button>
        </View>
      </View>
      <View className="gap-5 border-y border-border py-6">
        <View className="flex-row items-baseline justify-between gap-4">
          <Text
            accessibilityRole="header"
            className="text-sm font-medium text-muted-foreground"
          >
            {landingExample.title}
          </Text>
          <Text className="text-lg font-semibold text-foreground">
            {landingExample.phase}
          </Text>
        </View>
        {landingExample.messages.map((message) => (
          <View key={message.name} className="flex-row gap-3">
            <Text className="w-12 text-sm font-semibold leading-6 text-primary">
              {message.name}
            </Text>
            <Text className="flex-1 text-sm leading-6 text-foreground">
              {message.body}
            </Text>
          </View>
        ))}
        <View className="gap-3 border-t border-border pt-4">
          <Text className="text-sm leading-5 text-muted-foreground">
            {landingExample.vote}
          </Text>
          <Text className="text-sm font-medium leading-5 text-foreground">
            {landingExample.prompt}
          </Text>
        </View>
      </View>
    </View>
  );
}
