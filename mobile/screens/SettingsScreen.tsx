import React from "react";
import { Text, View } from "react-native";
import { commonStyles } from "../styles/commonStyles";

export function SettingsScreen() {
  return (
    <View style={commonStyles.container}>
      <Text style={commonStyles.centeredText}>Settings are not part of the parity navigation.</Text>
    </View>
  );
}
