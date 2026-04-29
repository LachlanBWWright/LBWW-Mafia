import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { StackParamList } from "../App";
import { Badge, Card, Screen, SectionHeader } from "../components/ui";

type AboutScreenProps = NativeStackScreenProps<StackParamList, "About">;

const features = [
  {
    title: "Real-Time Multiplayer",
    description: "WebSocket-based gameplay with instant updates.",
  },
  {
    title: "Multiple Game Modes",
    description: "Public matchmaking and private rooms.",
  },
  {
    title: "Diverse Role System",
    description: "Town, Mafia, and Neutral roles with unique abilities.",
  },
  {
    title: "Responsive Design",
    description: "Play on desktop, tablet, or mobile devices.",
  },
];

export function AboutScreen({ navigation }: AboutScreenProps) {
  return (
    <Screen
      navigation={navigation}
      activeRoute="About"
      title="About LBWW Mafia"
      subtitle="A modern take on the classic social deduction game."
    >
      <View className="gap-4">
        <Card>
          <SectionHeader title="The Project" />
          <View className="gap-2.5">
            <Text className="text-sm leading-5 text-muted-foreground">
              LBWW Mafia is an online multiplayer implementation of the classic Mafia social deduction game.
              Built with modern web technologies, it allows players from around the world to connect and play together in real-time.
            </Text>
            <Text className="text-sm leading-5 text-muted-foreground">
              The game features multiple roles with unique abilities, day/night cycles, and strategic gameplay that tests your deduction skills and ability to read others.
            </Text>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Features" />
          <View className="gap-3">
            {features.map((feature) => (
              <View key={feature.title} className="flex-row gap-3">
                <View className="h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  <Text className="text-base font-black text-primary">✓</Text>
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-[15px] font-extrabold text-foreground">
                    {feature.title}
                  </Text>
                  <Text className="text-sm leading-[18px] text-muted-foreground">
                    {feature.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>

        <Badge variant="secondary">Same product surface, native layout</Badge>
      </View>
    </Screen>
  );
}
