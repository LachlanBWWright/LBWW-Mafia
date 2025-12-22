import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { View, Text, Button, TextInput, Alert } from "react-native";
import { StackParamList } from "../App";
import { api } from "../utils/api";

type HomeScreenProps = NativeStackScreenProps<StackParamList, "HomeScreen">;

export function HomeScreen({ route: _route, navigation }: HomeScreenProps) {
  const [name, setName] = useState("");
  const [disabled, setDisabled] = useState(true);

  const createGameMutation = api.demo.createDemo.useMutation({
    onSuccess: (data) => {
      Alert.alert(
        "Game Created!",
        `Room Code: ${data.roomCode}`,
        [
          {
            text: "OK",
            onPress: () => {
              navigation.navigate("GameScreen", {
                lobbyId: data.roomCode,
                title: data.roomCode,
                name: validateText(name),
              });
            },
          },
        ]
      );
    },
    onError: (error) => {
      Alert.alert("Error", `Failed to create game: ${error.message}`);
    },
  });

  const handleCreateGame = () => {
    createGameMutation.mutate({
      maxPlayers: 10,
    });
  };

  return (
    <View
      style={{ alignSelf: "stretch", marginTop: "auto", flex: 1, padding: 20 }}
    >
      <Text
        style={{
          justifyContent: "flex-start",
          alignSelf: "center",
          fontSize: 25,
          fontWeight: "bold",
        }}
      >
        Welcome To MERN Mafia!
      </Text>
      <Text
        style={{ justifyContent: "flex-start", alignSelf: "center", flex: 1 }}
      >
        {name.length != 0 ? `Your name is "${name}"` : ""}
      </Text>

      <View style={{ alignContent: "space-between" }}>
        <TextInput
          onChangeText={(text) => {
            setName(text);
            text = validateText(text);
            setDisabled(!checkValidity(text));
          }}
          placeholder={"Enter your username, 3-12 lowercase letters only!"}
          autoComplete={"username"}
          value={name}
          style={{
            borderColor: "#0000FF",
            borderWidth: 1,
            borderRadius: 10,
            margin: 4,
          }}
        />
        <View style={{ margin: 4 }}>
          <Button
            title="Create New Game"
            disabled={disabled || createGameMutation.isPending}
            onPress={handleCreateGame}
            color={"#00AA00"}
          />
        </View>
        <View style={{ margin: 4 }}>
          <Button
            title="Join Private Game (Enter Code)"
            disabled={disabled}
            onPress={() => navigation.navigate("PrivateGameLobbyScreen")}
            color={"#FF0000"}
          />
        </View>
        <View style={{ margin: 4 }}>
          <Button
            title="Browse Public Games"
            disabled={disabled}
            onPress={() =>
              navigation.navigate("PublicGameLobbyScreen", {
                name: validateText(name),
              })
            }
            color={"#3333FF"}
          />
        </View>
      </View>
    </View>
  );
}

//Makes username lowercase, removes non-alphabetical characters
function validateText(text: string): string {
  text = text.toLowerCase();
  text = text.replace(/[0-9]/g, "");
  return text;
}

//Checks if the username is valid, for enabling 'Play' buttons
function checkValidity(text: string): boolean {
  return text.length >= 3 && text.length <= 12;
}
