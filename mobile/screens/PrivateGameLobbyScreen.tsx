import { type NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { View, Text, Button, TextInput, Alert, StyleSheet } from "react-native";
import { type StackParamList } from "../App";
import { api } from "../utils/api";

type PrivateGameLobbyScreenProps = NativeStackScreenProps<
  StackParamList,
  "PrivateGameLobbyScreen"
>;

export function PrivateGameLobbyScreen({
  route: _route,
  navigation,
}: PrivateGameLobbyScreenProps) {
  const [roomCode, setRoomCode] = useState("");
  const [username, setUsername] = useState("");

  const joinGameMutation = api.demo.joinDemo.useMutation({
    onSuccess: (data) => {
      navigation.navigate("GameScreen", {
        lobbyId: data.roomCode,
        title: data.roomCode,
        name: validateText(username),
      });
    },
    onError: (error) => {
      Alert.alert("Error", `Failed to join game: ${error.message}`);
    },
  });

  const handleJoinGame = () => {
    if (!roomCode.trim()) {
      Alert.alert("Error", "Please enter a room code");
      return;
    }
    if (!username.trim() || !checkValidity(validateText(username))) {
      Alert.alert("Error", "Please enter a valid username (3-12 lowercase letters)");
      return;
    }

    joinGameMutation.mutate({
      roomCode: roomCode.toUpperCase().trim(),
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join Private Game</Text>
      <Text style={styles.subtitle}>
        Enter the room code shared by the host
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Your Username:</Text>
        <TextInput
          onChangeText={(text) => { setUsername(text); }}
          placeholder="Enter your username"
          autoComplete="username"
          value={username}
          style={styles.input}
        />
        
        <Text style={styles.label}>Room Code:</Text>
        <TextInput
          onChangeText={(text) => { setRoomCode(text.toUpperCase()); }}
          placeholder="Enter 6-character room code"
          value={roomCode}
          maxLength={6}
          autoCapitalize="characters"
          style={styles.input}
        />

        <View style={styles.buttonContainer}>
          <Button
            title={joinGameMutation.isPending ? "Joining..." : "Join Game"}
            disabled={
              joinGameMutation.isPending ||
              !roomCode.trim() ||
              !checkValidity(validateText(username))
            }
            onPress={handleJoinGame}
            color="#3333FF"
          />
        </View>
      </View>
    </View>
  );
}

function validateText(text: string): string {
  text = text.toLowerCase();
  text = text.replace(/[0-9]/g, "");
  return text;
}

function checkValidity(text: string): boolean {
  return text.length >= 3 && text.length <= 12;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#666",
    marginBottom: 30,
  },
  inputContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderColor: "#0000FF",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  buttonContainer: {
    marginTop: 30,
  },
});
