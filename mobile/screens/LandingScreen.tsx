import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Text, View } from "react-native";
import { MessageCircle, Moon, Users } from "lucide-react-native";
import { StackParamList } from "../App";
import { Button, Card, Screen } from "../components/ui";

type LandingScreenProps = NativeStackScreenProps<StackParamList, "Home">;

export function LandingScreen({ navigation }: LandingScreenProps) {
  return (
    <Screen navigation={navigation} activeRoute="Home" scroll>
      <View className="flex-1 gap-6 py-6">
        <View className="gap-4">
          <Text className="text-[52px] font-black leading-[54px] tracking-[-2px] text-foreground">
            LBWW <Text className="text-primary">Mafia</Text>
          </Text>
          <Text className="text-base leading-6 text-muted-foreground">
            Enter a live game instantly, coordinate through chat, and make your
            move before the timer runs out.
          </Text>
        </View>

        <Button size="lg" className="self-start" onPress={() => navigation.navigate("Lobby")}>Join Game</Button>

        <Card>
          <Text className="text-lg font-extrabold text-foreground">Quick Start</Text>
          <View className="gap-4">
            <View className="flex-row items-center gap-3"><Users color="#5B8CFF" size={20} /><Text className="flex-1 text-sm text-muted-foreground">Join a public room.</Text></View>
            <View className="flex-row items-center gap-3"><Moon color="#5B8CFF" size={20} /><Text className="flex-1 text-sm text-muted-foreground">Watch day and night countdowns.</Text></View>
            <View className="flex-row items-center gap-3"><MessageCircle color="#5B8CFF" size={20} /><Text className="flex-1 text-sm text-muted-foreground">Chat, vote, visit, and whisper.</Text></View>
          </View>
        </Card>
      </View>
    </Screen>
  );
}
