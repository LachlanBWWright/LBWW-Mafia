import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState, useEffect, Dispatch, SetStateAction } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  DrawerLayoutAndroid,
  Vibration,
  StyleSheet,
} from "react-native";
import { StackParamList } from "../App";
import { StackActions } from "@react-navigation/native";
import io from "socket.io-client";
import { commonStyles } from "../styles/commonStyles";
import { colors } from "../styles/colors";

type Player = {
  name: string;
  isAlive?: boolean;
  role?: string;
  isUser?: boolean;
};

const styles = StyleSheet.create({
  messageContainer: {
    backgroundColor: colors.surface,
    flex: 1,
    borderRadius: 10,
    padding: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    marginTop: "auto",
    paddingVertical: 4,
    justifyContent: "space-between",
  },
  textInput: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 5,
    flex: 1,
    marginRight: 5,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
  },
  buttonRow: {
    alignSelf: "stretch",
    marginTop: "auto",
    paddingVertical: 4,
    borderRadius: 10,
    justifyContent: "flex-end",
  },
  playerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignSelf: "stretch",
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 5,
    padding: 5,
    margin: 2,
  },
  playerName: {
    flexGrow: 1,
    color: colors.textPrimary,
  },
  chatMessage: {
    color: colors.textPrimary,
  },
});

type GameScreenProps = NativeStackScreenProps<StackParamList, "GameScreen">;
export function GameScreen({ route, navigation }: GameScreenProps) {
  const SOCKET_URL =
    process.env.EXPO_PUBLIC_SOCKET_URL ??
    (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");
  const CAPTCHA_TOKEN =
    process.env.EXPO_PUBLIC_CAPTCHA_TOKEN ??
    (process.env.NODE_ENV === "development" ? "dev-bypass-token" : "");
  const [socket] = useState(io(SOCKET_URL));
  const [message, setMessage] = useState("");
  const [playerRole, setPlayerRole] = useState("");
  const [alive] = useState(true);

  // TODO: These are likely needed for future features
  const [_textMessage, _setTextMessage] = useState(""); //TODO: Redundant, probably
  const [canTalk, setCanTalk] = useState(true);
  const [time, setTime] = useState("Day");
  const [dayNumber, setDayNumber] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [messages, addMessage] = useState<string[]>([]);
  const [playerList, setPlayerList] = useState<Array<Player>>([]); //TODO: Update this!
  const [_visiting, setVisiting] = useState<string | null>();
  const [_votingFor, setVotingFor] = useState<string | null>();

  const [_drawerOpened, _setDrawerOpened] = useState(false);

  useEffect(() =>
    navigation.addListener("beforeRemove", (e) => {
      if (!alive) e.preventDefault();
    }),
  ); //Blocks leaving

  useEffect(() => {
    //Socket.io Integration - Runs on creation
    socket.on("connect", () => {});

    socket.on("receiveMessage", (inMsg: string) => {
      addMessage((old) => [...old, inMsg]);
    });

    socket.on("receive-chat-message", (inMsg: string) => {
      addMessage((old) => [...old, inMsg]);
    });

    socket.on("receive-whisper-message", (inMsg: string) => {
      addMessage((old) => [...old, inMsg]);
    });

    socket.on("receive-player-list", (listJson: Array<Player>) => {
      //Receive all players upon joining, and the game starting
      const list: Player[] = [];
      listJson.map((instance) => {
        list.push(instance);
      });
      setPlayerList(() => list);
    });

    socket.on("receive-new-player", (playerJson: Player) => {
      //Called when a new player joins the lobby
      setPlayerList((list) => [...list, playerJson]);
    });

    socket.on("remove-player", (playerJson: Player) => {
      //Called when a player leaves the lobby before the game starts
      setPlayerList((list) =>
        list.filter((item) => item.name !== playerJson.name),
      );
    });

    socket.on("assign-player-role", (playerJson: Player) => {
      //Shows the player their own role, lets the client know that this is who they are playing as
      let tempPlayerList: Array<Player> = [];
      setPlayerList((list) => (tempPlayerList = [...list]));
      let index = tempPlayerList.findIndex(
        (player) => player.name === playerJson.name,
      );
      tempPlayerList[index].role = playerJson.role;
      tempPlayerList[index].isUser = true;
      //TODO: Who player visits at day (living) (0 - Nobody, 1 - Self, 2 - Others, 3 - Everybody)
      //TODO: Who player visits at day (dead, will apply to almost (or currently) no roles)
      //TODO: Who player visits at night (living)
      //TODO: Who player visits at night (dead)
      setPlayerRole(playerJson.role ?? "");
      setPlayerList(tempPlayerList);
    });

    socket.on("update-player-role", (playerJson: Player) => {
      //Updates player role upon their death
      let tempPlayerList: Array<Player> = [];
      setPlayerList((list) => (tempPlayerList = [...list]));
      let index = tempPlayerList.findIndex(
        (player) => player.name === playerJson.name,
      );
      if (playerJson.role !== undefined)
        tempPlayerList[index].role = playerJson.role;
      tempPlayerList[index].isAlive = false;
      if (tempPlayerList[index].isUser) {
        setCanTalk(false); //Blocks MSGing upon death
        Vibration.vibrate([500, 200, 500, 200, 500], false); //(3 500ms vibrations with 200ms breaks, does not repeat indefinitely)
      }
      setPlayerList(tempPlayerList);
    });

    socket.on("update-player-visit", (_playerJson) => {
      //Updates player to indicate that the player is visiting them TODO: This might be depreciated in the actual game
      //JSON contains player name
      //Get player by name, update properties, update JSON
    });

    socket.on("update-day-time", (infoJson) => {
      //Gets whether it is day or night, and how long there is left in the session
      setTime(infoJson.time);
      setDayNumber(infoJson.dayNumber);
      setVisiting(null);
      setVotingFor(null);
      /*         this.setState({time: infoJson.time});
        this.setState({dayNumber: infoJson.dayNumber});
        this.setState({visiting: null}); //Resets who the player is visiting
        this.setState({votingFor: null}); */
      let timeLeftLocal = infoJson.timeLeft;
      let countDown = setInterval(() => {
        if (timeLeftLocal > 0) {
          setTimeLeft(timeLeftLocal - 1);
          timeLeftLocal--;
        } else {
          clearInterval(countDown);
        }
      }, 1000);
    });

    socket.on("blockMessages", () => {
      setCanTalk(false);
    });

    if (CAPTCHA_TOKEN) {
      socket.emit(
        "playerJoinRoom",
        CAPTCHA_TOKEN,
        (callback: string | number) => {
          if (typeof callback !== "string") {
            navigation.dispatch(StackActions.popToTop());
          }
        },
      );
    } else {
      navigation.dispatch(StackActions.popToTop());
    }

    return () => {
      //Runs Upon close
      socket.off("receiveMessage");
      socket.off("receive-chat-message");
      socket.off("receive-whisper-message");
      socket.off("blockMessages");
      socket.off("receive-role");
      socket.off("receive-player-list");
      socket.off("receive-new-player");
      socket.off("remove-player");
      socket.off("update-player-role");
      socket.off("update-player-visit");
      socket.disconnect();
    };
  }, [socket, navigation, route.params.name, CAPTCHA_TOKEN]);

  const flatList = React.useRef<FlatList<string>>(null);
  const drawer = React.useRef<DrawerLayoutAndroid>(null);

  return (
    <DrawerLayoutAndroid
      ref={drawer}
      drawerPosition={"right"}
      drawerWidth={300}
      renderNavigationView={() => (
        //Content of the drawer, should contain the list of players TODO: Make a flatlist
        <FlatList
          data={playerList}
          renderItem={({ item }) => (
            <PlayerInList
              player={item}
              socket={socket}
              setMessage={setMessage}
              time={time}
            />
          )}
        />
      )}
    >
      <View style={commonStyles.container}>
        <Text style={commonStyles.centeredText}>
          Name: "{route.params.name}"{" "}
          {playerRole !== "" ? "Role: " + playerRole + " | " : " | "}
          {time}: {dayNumber} | Time Left: {timeLeft}
        </Text>
        <View style={styles.messageContainer}>
          <FlatList
            ref={flatList}
            data={messages}
            renderItem={({ item }) => <Text style={styles.chatMessage}>{item}</Text>}
            onContentSizeChange={() => {
              if (flatList.current) flatList.current.scrollToEnd();
            }}
          />
        </View>

        {canTalk ? (
          <View style={styles.inputRow}>
            <TextInput
              onChangeText={(text) => {
                setMessage(text);
              }}
              placeholder={"Send a message"}
              value={message}
              style={styles.textInput}
              placeholderTextColor={colors.textSecondary}
              numberOfLines={2}
              maxLength={500}
              multiline={true}
              returnKeyType={"send"}
            />
            {message.length !== 0 ? (
              <Button
                title="→"
                onPress={() => {
                  socket.emit("messageSentByUser", message, time === "Day");
                  setMessage("");
                }}
                color={colors.accent}
              />
            ) : (
              <Button
                title="←"
                onPress={() => {
                  if (drawer.current) drawer.current.openDrawer();
                }}
                color={colors.danger}
              />
            )}
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <Button
              title="Disconnect"
              onPress={() => navigation.dispatch(StackActions.popToTop())}
              color={colors.danger}
            />
          </View>
        )}
      </View>
    </DrawerLayoutAndroid>
  );
}

function PlayerInList(props: {
  player: Player;
  socket: { emit: (event: string, ...args: unknown[]) => void };
  setMessage: Dispatch<SetStateAction<string>>;
  time: string;
}) {
  const [color, setColor] = useState(colors.surfaceMuted);

  useEffect(() => {
    if (props.player.isAlive !== undefined) {
      if (props.player.isAlive === false) setColor(colors.danger);
      else if (props.player.isUser === true) setColor(colors.accent);
      else if (props.player.isAlive === true) setColor(colors.success);
    }
  }, [props.player.isAlive, props.player.isUser]);

  return (
    <View
      style={[
        styles.playerContainer,
        { backgroundColor: color },
      ]}
    >
      <Text style={styles.playerName}>
        {props.player.name}{" "}
        {props.player.role !== undefined ? "(" + props.player.role + ")" : ""}
      </Text>
      {props.player.isAlive === true && props.player.isUser !== true && (
        <Button
          title="Whisper"
          onPress={() => props.setMessage("/w " + props.player.name)}
        />
      )}
      {props.player.isAlive === true && (
        <Button
          title="Visit"
          onPress={() =>
            props.socket.emit(
              "messageSentByUser",
              "/c " + props.player.name,
              props.time === "Day",
            )
          }
        />
      )}
      {props.player.isAlive === true && props.time === "Day" && (
        <Button
          title="Vote"
          onPress={() =>
            props.socket.emit(
              "messageSentByUser",
              "/v " + props.player.name,
              props.time === "Day",
            )
          }
        />
      )}
    </View>
  );
}
