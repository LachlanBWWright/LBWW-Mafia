import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StackParamList } from "../App";
import { LandingContent } from "../components/LandingContent";
import { Screen } from "../components/ui";

type LandingScreenProps = NativeStackScreenProps<StackParamList, "Home">;

export function LandingScreen({ navigation }: LandingScreenProps) {
  return (
    <Screen navigation={navigation} activeRoute="Home" scroll>
      <LandingContent
        onJoin={() => navigation.navigate("Lobby")}
        onCreate={() => navigation.navigate("CreateLobby")}
      />
    </Screen>
  );
}
