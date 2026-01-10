import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Button } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StackParamList } from "../App";

interface Lobby {
  name: string;
  roomType: string;
  size: number;
  playerCount: number;
}

type PublicGameLobbyScreenProps = NativeStackScreenProps<
  StackParamList,
  "PublicGameLobbyScreen"
>;

export function PublicGameLobbyScreen({
  route,
  navigation,
}: PublicGameLobbyScreenProps) {
  const [roomList, setRoomList] = useState<Lobby[]>([]);

  const navigateToGame = (lobbyId: string) => {
    navigation.navigate("GameScreen", {
      lobbyId: lobbyId,
      title: "Mern Mafia!",
      name: route.params.name,
    });
  };

  useEffect(
    () => {
      fetch("https://mern-mafia.herokuapp.com/getRooms")
        .then((res) => res.json())
        .then((res) => setRoomList(res));
    },
    [] /*Array of things that should prompt the useEffect hook to be called*/,
  );

  return (
    <View
      style={{ alignSelf: "stretch", marginTop: "auto", flex: 1, padding: 20 }}
    >
      {roomList.length !== 0 ? (
        <View>
          <FlatList
            data={roomList}
            renderItem={({ item }) => (
              <LobbyView lobby={item} navigate={navigateToGame} />
            )}
          />
        </View>
      ) : (
        <Text>Loading... </Text>
      )}
    </View>
  );
}
//{/* <LobbyView lobby={item}/> */}
const LobbyView = (props: {
  lobby: Lobby;
  navigate: (name: string) => void;
}) => {
  return (
    <View style={{ flexDirection: "row", padding: 5 }}>
      <Text style={{ flex: 1 }}>
        Name: {props.lobby.name} ({props.lobby.playerCount}/{props.lobby.size})
      </Text>

      <Button
        color="red"
        title="Join"
        onPress={() => props.navigate(props.lobby.name)}
      />
    </View>
  );
};
