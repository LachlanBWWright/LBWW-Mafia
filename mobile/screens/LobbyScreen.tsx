import React, { useEffect, useState } from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  canPerformVisit,
  canVoteTarget,
  canWhisperTarget,
  shouldShowDayOnlyActions,
  shouldShowVisitAction,
} from "../../shared/game/playerActionRules";
import { StackParamList } from "../App";
import { useAppState } from "../context/AppStateContext";
import { Button, Badge, Card, EmptyState, Input, ListRow, Screen, SectionHeader } from "../components/ui";
import { useGameLobby } from "../lib/useGameLobby";

type LobbyScreenProps = NativeStackScreenProps<StackParamList, "Lobby">;

const ROOM_ID = process.env.EXPO_PUBLIC_PARTYKIT_ROOM ?? "default";

export function LobbyScreen({ navigation }: LobbyScreenProps) {
  const { setPlayerName, setLastRoomName } = useAppState();
  const lobby = useGameLobby(ROOM_ID);
  const [activeTab, setActiveTab] = useState<"chat" | "players">("chat");

  useEffect(() => {
    if (lobby.playerName.trim()) {
      setPlayerName(lobby.playerName);
      setLastRoomName(ROOM_ID);
    }
  }, [ROOM_ID, lobby.playerName, setLastRoomName, setPlayerName]);

  const currentPlayer = lobby.players.find((entry) => entry.name === lobby.playerName);
  const isCurrentUserAlive = currentPlayer?.isAlive !== false;
  const showVisit = shouldShowVisitAction(lobby.time, lobby.visitCapability);
  const dayOnlyActions = shouldShowDayOnlyActions(lobby.time);

  return (
    <Screen
      navigation={navigation}
      activeRoute="Lobby"
      title="Lobby"
      subtitle="Join the game, follow the timer, and act from the player panel."
      scroll={false}
    >
      {lobby.playerName ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <View className="flex-1 gap-3">
            <Card className="pb-3">
              <View className="flex-row flex-wrap gap-2">
                <Badge variant="secondary">{lobby.time}</Badge>
                <Badge variant="outline">Day {lobby.dayNumber}</Badge>
                <Badge variant="outline">{lobby.timeLeft}s left</Badge>
                <Badge variant={isCurrentUserAlive ? "primary" : "destructive"}>
                  {isCurrentUserAlive ? "Alive" : "Dead"}
                </Badge>
              </View>
              <Text className="text-sm leading-[18px] text-muted-foreground">
                You joined as <Text className="font-bold text-foreground">{lobby.playerName}</Text>
                {lobby.currentUserRole ? (
                  <>
                    {" "}
                    • <Text className="text-primary">{lobby.currentUserRole}</Text>
                  </>
                ) : null}
              </Text>
            </Card>

            <View className="flex-row gap-2">
              <Button
                variant={activeTab === "chat" ? "primary" : "secondary"}
                size="sm"
                className="flex-1"
                onPress={() => setActiveTab("chat")}
              >
                Chat
              </Button>
              <Button
                variant={activeTab === "players" ? "primary" : "secondary"}
                size="sm"
                className="flex-1"
                onPress={() => setActiveTab("players")}
              >
                Players
              </Button>
            </View>

            <View className="flex-1">
              {activeTab === "chat" ? (
                <Card className="flex-1">
                  <SectionHeader
                    title="Chat"
                    subtitle={lobby.canTalk ? "Send a public message or whisper from the player list." : "You cannot talk right now."}
                  />
                  <ScrollView
                    className="flex-1"
                    contentContainerClassName="gap-2 pb-3"
                    showsVerticalScrollIndicator={false}
                  >
                    {lobby.messages.length === 0 ? (
                      <Text className="text-sm text-muted-foreground">
                        No messages yet.
                      </Text>
                    ) : (
                      lobby.messages.map((message) => (
                        <Text key={message.id} className="text-sm leading-5 text-foreground">
                          {message.text}
                        </Text>
                      ))
                    )}
                  </ScrollView>
                  <View className="gap-2">
                    <Input
                      value={lobby.messageDraft}
                      onChangeText={lobby.setMessageDraft}
                      placeholder={lobby.canTalk ? "Send a message..." : "You cannot talk right now"}
                      multiline
                      numberOfLines={3}
                    />
                    <Button
                      onPress={lobby.sendMessage}
                      disabled={!lobby.canTalk || !lobby.messageDraft.trim()}
                    >
                      Send
                    </Button>
                  </View>
                </Card>
              ) : (
                <Card className="flex-1">
                  <SectionHeader
                    title="Players"
                    subtitle="Vote, visit, and whisper from the row actions."
                  />
                  <ScrollView
                    className="flex-1"
                    contentContainerClassName="gap-2 pb-3"
                    showsVerticalScrollIndicator={false}
                  >
                    {lobby.players.length === 0 ? (
                      <Text className="text-sm text-muted-foreground">
                        Waiting for players...
                      </Text>
                    ) : (
                      lobby.players.map((player, index) => {
                        const isSelf = player.name === lobby.playerName;
                        const targetAlive = player.isAlive !== false;
                        const canVote =
                          canVoteTarget({
                            time: lobby.time,
                            actorAlive: isCurrentUserAlive,
                            targetAlive,
                            isSelf,
                            canVote: lobby.canVote,
                          }) && dayOnlyActions;
                        const canWhisper = canWhisperTarget({
                          time: lobby.time,
                          targetAlive,
                          isSelf,
                          hasMessage: Boolean(lobby.messageDraft.trim()),
                        });
                        const canVisit =
                          showVisit &&
                          canPerformVisit({
                            time: lobby.time,
                            isSelf,
                            targetAlive,
                            actorAlive: isCurrentUserAlive,
                            actorRole: lobby.currentUserRole,
                            targetRole: player.role,
                            capability: lobby.visitCapability,
                          });

                        return (
                          <ListRow
                            key={player.name}
                            title={`${player.name}${isSelf ? " (You)" : ""}`}
                            subtitle={player.role ? `Role: ${player.role}` : "Role hidden"}
                            tone={player.isAlive === false ? "danger" : player.isAlive ? "success" : "muted"}
                            trailing={
                              <View className="flex-row gap-1.5">
                                {showVisit ? (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onPress={() => lobby.visitPlayer(index)}
                                    disabled={!canVisit}
                                  >
                                    V
                                  </Button>
                                ) : null}
                                {dayOnlyActions ? (
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    onPress={() => lobby.voteForPlayer(index)}
                                    disabled={!canVote}
                                  >
                                    ✓
                                  </Button>
                                ) : null}
                                {dayOnlyActions ? (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onPress={() => lobby.whisperToPlayer(index)}
                                    disabled={!canWhisper}
                                  >
                                    W
                                  </Button>
                                ) : null}
                              </View>
                            }
                          />
                        );
                      })
                    )}
                  </ScrollView>
                </Card>
              )}
            </View>

            {lobby.joinStatus ? (
              <Text className="text-xs text-muted-foreground">
                {lobby.joinStatus}
              </Text>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      ) : (
        <EmptyState
          title="Connecting to Game Lobby"
          description={lobby.joinStatus || "Attempting to join a room now..."}
          action={
            <Button onPress={lobby.joinGame} disabled={lobby.joining}>
              {lobby.joining ? "Connecting..." : "Retry Connection"}
            </Button>
          }
        />
      )}
    </Screen>
  );
}
