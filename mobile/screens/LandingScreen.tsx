import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { View, Text } from "react-native";
import { StackParamList } from "../App";
import { Button, Card, EmptyState, Screen } from "../components/ui";
import { colors } from "../styles/colors";

type LandingScreenProps = NativeStackScreenProps<StackParamList, "Home">;

export function LandingScreen({ navigation }: LandingScreenProps) {
  return (
    <Screen navigation={navigation} activeRoute="Home" scroll>
      <View style={{ gap: 16 }}>
        <View style={{ gap: 12 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 44,
              lineHeight: 46,
              fontWeight: "900",
              letterSpacing: -1.2,
            }}
          >
            LBWW <Text style={{ color: colors.primary }}>Mafia</Text>
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontSize: 16,
              lineHeight: 23,
            }}
          >
            Enter a live game instantly, coordinate through chat, and make your
            move before the timer runs out.
          </Text>
        </View>

        <Button size="lg" onPress={() => navigation.navigate("Lobby")}>
          Join Game
        </Button>

        <Card>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 18,
              fontWeight: "800",
            }}
          >
            Quick Start
          </Text>
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
              1. Join a public room.
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
              2. Watch day/night countdowns.
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>
              3. Chat, vote, visit, and whisper from the player panel.
            </Text>
          </View>
        </Card>

        <EmptyState
          title="Need a reference point?"
          description="Roles, About, History, Profile, and Admin each map to the web app's navigation model."
          action={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button variant="secondary" size="sm" onPress={() => navigation.navigate("Roles")}>
                Roles
              </Button>
              <Button variant="outline" size="sm" onPress={() => navigation.navigate("About")}>
                About
              </Button>
            </View>
          }
        />
      </View>
    </Screen>
  );
}
