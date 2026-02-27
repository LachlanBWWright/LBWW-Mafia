import React from "react";
import { View, Text } from "react-native";
import { commonStyles } from "../styles/commonStyles";

export function SettingsScreen() {
  return (
    <View style={commonStyles.container}>
      <Text style={commonStyles.centeredText}>Settings</Text>
    </View>
  );
}
