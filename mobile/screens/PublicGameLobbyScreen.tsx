import React from "react";
import { Text, View } from "react-native";
import { commonStyles } from "../styles/commonStyles";

export function PublicGameLobbyScreen() {
  return (
    <View style={commonStyles.container}>
      <Text style={commonStyles.centeredText}>Public lobby is now the main Lobby screen.</Text>
    </View>
  );
}
