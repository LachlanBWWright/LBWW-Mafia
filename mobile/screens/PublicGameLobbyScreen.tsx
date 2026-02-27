import React from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StackParamList } from "../App";
import { commonStyles } from "../styles/commonStyles";
import { colors } from "../styles/colors";

type PublicGameLobbyScreenProps = NativeStackScreenProps<
  StackParamList,
  "PublicGameLobbyScreen"
>;

const styles = StyleSheet.create({
  description: {
    color: colors.textSecondary,
    marginBottom: 12,
    textAlign: "center",
  },
});

export function PublicGameLobbyScreen({
  route,
  navigation,
}: PublicGameLobbyScreenProps) {
  return (
    <View style={commonStyles.container}>
      <Text style={commonStyles.centeredText}>Public Lobby</Text>
      <Text style={styles.description}>
        Join the active game room. If the current room is full, the backend will
        create the next room automatically.
      </Text>
      <Button
        title="Join Game"
        color={colors.accent}
        onPress={() =>
          navigation.navigate("GameScreen", {
            title: "LBWW Mafia",
            name: route.params.name,
          })
        }
      />
    </View>
  );
}
