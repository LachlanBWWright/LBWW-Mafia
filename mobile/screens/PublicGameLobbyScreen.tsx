import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Button, ActivityIndicator } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StackParamList } from "../App";
import { api } from "../utils/api";

interface GameSession {
  id: string;
  roomCode: string;
  roomId: string;
  maxPlayers: number;
  status: string;
  participants: Array<{
    user: {
      id: string;
      name: string | null;
      image: string | null;
    };
  }>;
}

type PublicGameLobbyScreenProps = NativeStackScreenProps<
  StackParamList,
  "PublicGameLobbyScreen"
>;

export function PublicGameLobbyScreen({
  route,
  navigation,
}: PublicGameLobbyScreenProps) {
  const { data: activeSessions, isLoading, error } = api.gameSession.getActive.useQuery();

  const navigateToGame = (roomCode: string) => {
    navigation.navigate("GameScreen", {
      lobbyId: roomCode,
      title: "Mern Mafia!",
      name: route.params.name,
    });
  };

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color="#3333FF" />
        <Text style={{ marginTop: 10 }}>Loading games...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}
      >
        <Text style={{ color: "red", textAlign: "center" }}>
          Error loading games: {error.message}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{ alignSelf: "stretch", marginTop: "auto", flex: 1, padding: 20 }}
    >
      {activeSessions && activeSessions.length > 0 ? (
        <FlatList
          data={activeSessions}
          renderItem={({ item }) => (
            <GameSessionView session={item} navigate={navigateToGame} />
          )}
          keyExtractor={(item) => item.id}
        />
      ) : (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text>No active games found.</Text>
          <Text style={{ marginTop: 10, color: "#666" }}>
            Create a new game to get started!
          </Text>
        </View>
      )}
    </View>
  );
}

const GameSessionView = (props: {
  session: GameSession;
  navigate: (roomCode: string) => void;
}) => {
  const playerCount = props.session.participants.length;
  
  return (
    <View style={{ flexDirection: "row", padding: 10, marginVertical: 5, backgroundColor: "#f0f0f0", borderRadius: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "bold" }}>
          Room: {props.session.roomCode}
        </Text>
        <Text>
          Players: {playerCount}/{props.session.maxPlayers}
        </Text>
      </View>

      <Button
        color="#3333FF"
        title="Join"
        onPress={() => props.navigate(props.session.roomCode)}
        disabled={playerCount >= props.session.maxPlayers}
      />
    </View>
  );
};
