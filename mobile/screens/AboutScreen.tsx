import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { StackParamList } from "../App";
import { Badge, Card, Screen, SectionHeader } from "../components/ui";
import { colors } from "../styles/colors";

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
      <View style={{ gap: 16 }}>
        <Card>
          <SectionHeader title="The Project" />
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>
              LBWW Mafia is an online multiplayer implementation of the classic Mafia social deduction game.
              Built with modern web technologies, it allows players from around the world to connect and play together in real-time.
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 20 }}>
              The game features multiple roles with unique abilities, day/night cycles, and strategic gameplay that tests your deduction skills and ability to read others.
            </Text>
          </View>
        </Card>

        <Card>
          <SectionHeader title="Features" />
          <View style={{ gap: 12 }}>
            {features.map((feature) => (
              <View key={feature.title} style={{ flexDirection: "row", gap: 12 }}>
                <View
                  style={{
                    height: 28,
                    width: 28,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(91, 140, 255, 0.12)",
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "900" }}>✓</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>
                    {feature.title}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 18 }}>
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
