import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { StackParamList } from "../App";
import { StackActions } from "@react-navigation/native";
import io, { type Socket } from "socket.io-client";
import { commonStyles } from "../styles/commonStyles";
import { colors } from "../styles/colors";
import { trpcClient } from "../lib/trpc";
import type { RecentMatchSummary } from "../../shared/trpc/appRouter";
import {
  canPerformVisit,
  defaultVisitCapability,
  shouldShowDayOnlyActions,
  shouldShowVisitAction,
  type VisitCapability,
} from "../../shared/game/playerActionRules";

type Player = {
  name: string;
  isAlive?: boolean;
  role?: string;
  isUser?: boolean;
};

type DayTimeInfo = {
  time: string;
  dayNumber: number;
  timeLeft: number;
};
type RoleAssignment = Player & VisitCapability;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: 8,
  },
  topMeta: {
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
  },
  tabButtonActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  messageContainer: {
    backgroundColor: colors.surface,
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
  },
  chatMessage: {
    color: colors.textPrimary,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  textInput: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    flex: 1,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sendButton: {
    borderRadius: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  playerContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
    gap: 6,
  },
  playerName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 12,
  },
  playerActionRow: {
    flexDirection: "row",
    gap: 4,
  },
  iconButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  iconButtonText: {
    color: colors.textPrimary,
    fontSize: 11,
  },
  deadRow: {
    backgroundColor: colors.danger,
  },
  aliveRow: {
    backgroundColor: colors.success,
  },
  neutralRow: {
    backgroundColor: colors.surfaceMuted,
  },
  disconnectButton: {
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    paddingVertical: 10,
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

  const [socket] = useState<Socket>(() => io(SOCKET_URL));
  const [message, setMessage] = useState("");
  const [joinedAs, setJoinedAs] = useState(route.params.name);
  const [playerRole, setPlayerRole] = useState("");
  const [isAlive, setIsAlive] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "players" | "history">("chat");

  const [canTalk, setCanTalk] = useState(true);
  const [time, setTime] = useState("Day");
  const [dayNumber, setDayNumber] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);
  const [playerList, setPlayerList] = useState<Player[]>([]);
  const [visitCapability, setVisitCapability] =
    useState<VisitCapability>(defaultVisitCapability);
  const [recentMatches, setRecentMatches] = useState<RecentMatchSummary[]>([]);
  const [recentMatchesStatus, setRecentMatchesStatus] = useState("");

  const flatList = useRef<FlatList<string>>(null);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (!isAlive) {
          event.preventDefault();
        }
      }),
    [isAlive, navigation],
  );

  useEffect(() => {
    socket.on("receiveMessage", (incomingMessage: string) => {
      setMessages((current) => [...current, incomingMessage]);
    });

    socket.on("receive-chat-message", (incomingMessage: string) => {
      setMessages((current) => [...current, incomingMessage]);
    });

    socket.on("receive-whisper-message", (incomingMessage: string) => {
      setMessages((current) => [...current, incomingMessage]);
    });

    socket.on("receive-player-list", (listJson: Player[]) => {
      const list: Player[] = [];
      for (const player of listJson) {
        list.push(player);
      }
      setPlayerList(list);
    });

    socket.on("receive-new-player", (playerJson: Player) => {
      setPlayerList((list) => [...list, playerJson]);
    });

    socket.on("remove-player", (playerJson: Player) => {
      setPlayerList((list) => list.filter((item) => item.name !== playerJson.name));
    });

    socket.on("assign-player-role", (playerJson: RoleAssignment) => {
      setPlayerList((list) =>
        list.map((player) =>
          player.name === playerJson.name
            ? { ...player, role: playerJson.role, isUser: true }
            : player,
        ),
      );
      setPlayerRole(playerJson.role ?? "");
      setVisitCapability({
        dayVisitSelf: playerJson.dayVisitSelf,
        dayVisitOthers: playerJson.dayVisitOthers,
        dayVisitFaction: playerJson.dayVisitFaction,
        nightVisitSelf: playerJson.nightVisitSelf,
        nightVisitOthers: playerJson.nightVisitOthers,
        nightVisitFaction: playerJson.nightVisitFaction,
      });
    });

    socket.on("update-player-role", (playerJson: Player) => {
      setPlayerList((list) =>
        list.map((player) => {
          if (player.name !== playerJson.name) {
            return player;
          }
          const nextPlayer = {
            ...player,
            isAlive: false,
            role: playerJson.role ?? player.role,
          };
          if (nextPlayer.isUser) {
            setCanTalk(false);
            setIsAlive(false);
            Vibration.vibrate([500, 200, 500, 200, 500], false);
          }
          return nextPlayer;
        }),
      );
    });

    socket.on("update-day-time", (infoJson: DayTimeInfo) => {
      setTime(infoJson.time);
      setDayNumber(infoJson.dayNumber);
      setTimeLeft(infoJson.timeLeft);
    });

    socket.on("blockMessages", () => {
      setCanTalk(false);
    });

    if (CAPTCHA_TOKEN) {
      socket.emit("playerJoinRoom", CAPTCHA_TOKEN, (callback: string | number) => {
        if (typeof callback === "string") {
          setJoinedAs(callback);
          setMessages([`System: You joined as ${callback}.`]);
          return;
        }
        navigation.dispatch(StackActions.popToTop());
      });
    } else {
      navigation.dispatch(StackActions.popToTop());
    }

    return () => {
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
      socket.off("update-day-time");
      socket.disconnect();
    };
  }, [CAPTCHA_TOKEN, navigation, socket]);

  useEffect(() => {
    if (timeLeft <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  useEffect(() => {
    if (!joinedAs.trim()) {
      return;
    }

    setRecentMatchesStatus("Loading recent matches...");
    void trpcClient.match.recentByUsername
      .query({
        username: joinedAs,
        limit: 8,
      })
      .then((historyRows: RecentMatchSummary[]) => {
        setRecentMatches(historyRows);
        setRecentMatchesStatus(
          historyRows.length === 0 ? "No recent matches found." : "",
        );
      })
      .catch((error: unknown) => {
        setRecentMatchesStatus(
          error instanceof Error ? error.message : "Failed to load recent matches.",
        );
      });
  }, [joinedAs]);

  return (
    <View style={[commonStyles.container, styles.root]} className="bg-slate-950">
      <View style={styles.topMeta} className="rounded-xl">
        <Text style={styles.metaText}>
          {time} {dayNumber} • {timeLeft}s left
        </Text>
        <Text style={styles.metaText}>
          {joinedAs} {playerRole ? `• ${playerRole}` : ""}
        </Text>
      </View>

      <View style={styles.tabRow} className="mb-1">
        <Pressable
          style={[styles.tabButton, activeTab === "chat" && styles.tabButtonActive]}
          onPress={() => setActiveTab("chat")}
        >
          <Text style={styles.tabText}>Chat</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === "players" && styles.tabButtonActive]}
          onPress={() => setActiveTab("players")}
        >
          <Text style={styles.tabText}>Players</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === "history" && styles.tabButtonActive]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={styles.tabText}>History</Text>
        </Pressable>
      </View>

      {activeTab === "chat" ? (
        <View style={styles.messageContainer} className="rounded-xl">
          <FlatList
            ref={flatList}
            data={messages}
            renderItem={({ item }) => <Text style={styles.chatMessage}>{item}</Text>}
            onContentSizeChange={() => {
              flatList.current?.scrollToEnd();
            }}
          />
        </View>
      ) : activeTab === "players" ? (
        <View style={styles.messageContainer} className="rounded-xl">
          <FlatList
            data={playerList}
            renderItem={({ item }) => (
              <PlayerInList
                currentUser={joinedAs}
                player={item}
                socket={socket}
                setMessage={setMessage}
                time={time}
                actorRole={playerRole}
                actorAlive={isAlive}
                visitCapability={visitCapability}
              />
            )}
          />
        </View>
      ) : (
        <View style={styles.messageContainer} className="rounded-xl">
          <FlatList
            data={recentMatches}
            ListEmptyComponent={
              <Text style={styles.chatMessage}>
                {recentMatchesStatus || "No recent matches found."}
              </Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.playerContainer, styles.neutralRow]}>
                <Text style={styles.playerName}>
                  #{item.id} • {item.winningFaction} won •{" "}
                  {new Date(item.endedAt).toLocaleDateString()}
                </Text>
              </View>
            )}
          />
        </View>
      )}

      {canTalk ? (
        <View style={styles.inputRow}>
          <TextInput
            onChangeText={setMessage}
            placeholder={
              activeTab === "chat" ? "Send a message" : "Type /w [name] message"
            }
            value={message}
            style={styles.textInput}
            placeholderTextColor={colors.textSecondary}
            numberOfLines={2}
            maxLength={500}
            multiline={true}
            returnKeyType={"send"}
          />
          <Pressable
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
            disabled={!message.trim()}
            onPress={() => {
              socket.emit("messageSentByUser", message, time === "Day");
              setMessage("");
            }}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.disconnectButton}
          onPress={() => navigation.dispatch(StackActions.popToTop())}
        >
          <Text style={styles.sendButtonText}>Disconnect</Text>
        </Pressable>
      )}
    </View>
  );
}

function PlayerInList(props: {
  currentUser: string;
  player: Player;
  socket: Socket;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  time: string;
  actorRole: string;
  actorAlive: boolean;
  visitCapability: VisitCapability;
}) {
  const rowStyle =
    props.player.isAlive === false
      ? styles.deadRow
      : props.player.isAlive === true
        ? styles.aliveRow
        : styles.neutralRow;

  return (
    <View style={[styles.playerContainer, rowStyle]}>
      <Text style={styles.playerName}>
        {props.player.name}
        {props.player.name === props.currentUser ? " (You)" : ""}
      </Text>
      {props.player.isAlive !== false && props.player.name !== props.currentUser ? (
        <View style={styles.playerActionRow}>
          {shouldShowDayOnlyActions(props.time) ? (
            <Pressable
              style={styles.iconButton}
              onPress={() => props.setMessage(`/w ${props.player.name} `)}
            >
              <Text style={styles.iconButtonText}>💬</Text>
            </Pressable>
          ) : null}
          {shouldShowVisitAction(props.time, props.visitCapability) ? (
            <Pressable
              style={styles.iconButton}
              disabled={
                !canPerformVisit({
                  time: props.time,
                  isSelf: props.player.name === props.currentUser,
                  targetAlive: true,
                  actorAlive: props.actorAlive,
                  actorRole: props.actorRole,
                  targetRole: props.player.role,
                  capability: props.visitCapability,
                })
              }
              onPress={() =>
                props.socket.emit(
                  "messageSentByUser",
                  `/c ${props.player.name}`,
                  props.time === "Day",
                )
              }
            >
              <Text style={styles.iconButtonText}>👁</Text>
            </Pressable>
          ) : null}
          {shouldShowDayOnlyActions(props.time) ? (
            <Pressable
              style={styles.iconButton}
              disabled={!props.actorAlive}
              onPress={() =>
                props.socket.emit(
                  "messageSentByUser",
                  `/v ${props.player.name}`,
                  props.time === "Day",
                )
              }
            >
              <Text style={styles.iconButtonText}>🗳</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
