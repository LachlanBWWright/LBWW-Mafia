import React from "react";
import { Text, View } from "react-native";
import { commonStyles } from "../styles/commonStyles";

export function HowToPlayScreen() {
  return (
    <View style={commonStyles.container}>
      <Text style={commonStyles.centeredText}>How-to-play content moved into Roles, About, and the Lobby quick-start flow.</Text>
    </View>
  );
}
