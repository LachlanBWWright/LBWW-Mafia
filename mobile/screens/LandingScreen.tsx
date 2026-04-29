import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { StackParamList } from "../App";
import { Button, Card, EmptyState, Screen } from "../components/ui";

type LandingScreenProps = NativeStackScreenProps<StackParamList, "Home">;

export function LandingScreen({ navigation }: LandingScreenProps) {
  return (
    <Screen navigation={navigation} activeRoute="Home" scroll>
      <View className="gap-4">
        <View className="gap-3">
          <Text className="text-[44px] font-black leading-[46px] tracking-[-1.2px] text-foreground">
            LBWW <Text className="text-primary">Mafia</Text>
          </Text>
          <Text className="text-base leading-6 text-muted-foreground">
            Enter a live game instantly, coordinate through chat, and make your
            move before the timer runs out.
          </Text>
        </View>

        <Button size="lg" onPress={() => navigation.navigate("Lobby")}>
          Join Game
        </Button>

        <Card>
          <Text className="text-lg font-extrabold text-foreground">
            Quick Start
          </Text>
          <View className="gap-2.5">
            <Text className="text-sm text-muted-foreground">
              1. Join a public room.
            </Text>
            <Text className="text-sm text-muted-foreground">
              2. Watch day/night countdowns.
            </Text>
            <Text className="text-sm text-muted-foreground">
              3. Chat, vote, visit, and whisper from the player panel.
            </Text>
          </View>
        </Card>

        <EmptyState
          title="Need a reference point?"
          description="Roles, About, History, Profile, and Admin each map to the web app's navigation model."
          action={
            <View className="flex-row gap-2">
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
