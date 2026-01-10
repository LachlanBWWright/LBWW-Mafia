import { type NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { View, Text, Button, TextInput, Alert, ScrollView } from "react-native";
import { type StackParamList } from "../App";
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
    <ScrollView contentContainerStyle={{ padding: 20 }} className="flex-1 bg-white">
      <Text className="text-center text-2xl font-bold mb-5 text-black">
        Welcome To MERN Mafia!
      </Text>
      <Text className="text-center mb-5 text-gray-700">
        {name.length != 0 ? `Your name is "${name}"` : ""}
      </Text>

      <View className="mb-5">
        <TextInput
          onChangeText={(text) => {
            setName(text);
            text = validateText(text);
            setDisabled(!checkValidity(text));
          }}
          placeholder={"Enter your username, 3-12 lowercase letters only!"}
          autoComplete={"username"}
          value={name}
          className="border border-blue-600 rounded-lg p-3 my-2 text-base"
        />
        <View className="my-1">
          <Button
            title="Create New Game"
            disabled={disabled || createGameMutation.isPending}
            onPress={handleCreateGame}
            color={"#00AA00"}
          />
        </View>
        <View className="my-1">
          <Button
            title="Join Private Game (Enter Code)"
            disabled={disabled}
            onPress={() => { navigation.navigate("PrivateGameLobbyScreen"); }}
            color={"#FF0000"}
          />
        </View>
        <View className="my-1">
          <Button
            title="Browse Public Games"
            disabled={disabled}
            onPress={() =>
              { navigation.navigate("PublicGameLobbyScreen", {
                name: validateText(name),
              }); }
            }
            color={"#3333FF"}
          />
        </View>
      </View>

      <Text className="text-lg font-bold mt-5 mb-3 text-black">
        More Options
      </Text>

      <View className="gap-3">
        <Button
          title="Match History"
          onPress={() => navigation.navigate("HistoryScreen")}
          color="#4B5563"
        />
        <Button
          title="Leaderboard"
          onPress={() => navigation.navigate("LeaderboardScreen")}
          color="#4B5563"
        />
        <Button
          title="Roles Wiki"
          onPress={() => navigation.navigate("RolesScreen")}
          color="#4B5563"
        />
        <Button
          title="Your Stats"
          onPress={() => navigation.navigate("StatsScreen")}
          color="#4B5563"
        />
      </View>
    </ScrollView>
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
