import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Button, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { StackParamList } from "../App";
import { commonStyles } from "../styles/commonStyles";
import { colors } from "../styles/colors";

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

const styles = StyleSheet.create({
  lobbyContainer: {
    flexDirection: "row",
    padding: 5,
  },
  lobbyText: {
    flex: 1,
    color: colors.textPrimary,
  },
  loadingText: {
    color: colors.textSecondary,
  },
});

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
    <View style={commonStyles.container}>
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
        <Text style={styles.loadingText}>Loading... </Text>
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
    <View style={styles.lobbyContainer}>
      <Text style={styles.lobbyText}>
        Name: {props.lobby.name} ({props.lobby.playerCount}/{props.lobby.size})
      </Text>

      <Button
        color={colors.danger}
        title="Join"
        onPress={() => props.navigate(props.lobby.name)}
      />
    </View>
  );
};
