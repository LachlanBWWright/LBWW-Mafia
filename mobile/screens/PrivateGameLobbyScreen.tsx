import React from "react";
import { Text, View } from "react-native";
import { commonStyles } from "../styles/commonStyles";

export function PrivateGameLobbyScreen() {
  return (
    <View style={commonStyles.container}>
      <Text style={commonStyles.centeredText}>Private games are folded into the main lobby flow.</Text>
    </View>
  );
}
