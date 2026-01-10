import React from "react";
import { View, Text } from "react-native";
import { commonStyles } from "../styles/commonStyles";

export function PrivateGameLobbyScreen() {
  return (
    <View style={commonStyles.container}>
      <Text style={commonStyles.centeredText}>Welcome To MERN Mafia!</Text>
      <Text style={commonStyles.centeredText}>
        A list of games should go right about here!
      </Text>
    </View>
  );
}
