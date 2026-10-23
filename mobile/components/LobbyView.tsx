import { ObserverNotice } from "./ObserverNotice";
import { PrivateNotesPanel } from "./PrivateNotesPanel";
import { LobbyGroupPanel } from "./LobbyGroupPanel";
import { authIdentity } from "../lib/authIdentity";
import { GamePlayerRow } from "./GamePlayerRow";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import {
  canConfigureAiCharacters,
  phaseActionHint,
  voteSummary,
} from "../../shared/game/matchExperience";
import { shouldShowVisitAction } from "../../shared/game/playerActionRules";
import { Button, EmptyState, Input } from "./ui";
import { AiCharactersSetup } from "./AiCharactersPanel";
import {
  ChatLog,
  MatchRecapPanel,
  PhaseHeader,
  RoleReference,
} from "./MatchPanels";

import type { LobbyState } from "../../shared/game/lobbyState";
import type { LobbyActions } from "../../shared/game/useGameLobby";
import {
  resolveLobbyTab,
  type LobbyTab,
  type LobbyTabSelection,
} from "../../shared/game/lobbyPresentation";

export type LobbyViewProps = {
  lobby: LobbyState & LobbyActions;
  roomId: string;
  practice?: boolean;
  onPracticeChange: (value: boolean) => void;
  onSpectate: () => void;
  spectating?: boolean;
  authToken?: string;
  onFollowRoom?: (roomId: string) => void;
  initialTab?: LobbyTab;
};

/** Production match presentation shared by the native screen and its stories. */
export function LobbyView({
  lobby,
  roomId,
  practice = false,
  onPracticeChange,
  onSpectate,
  spectating = false,
  authToken,
  onFollowRoom,
  initialTab,
}: LobbyViewProps) {
  const observer =
    lobby.participation === "spectator" || lobby.participation === "eliminated";
  const context = {
    scope: `${roomId}:${practice}:${lobby.participation}:${lobby.matchId ?? ""}`,
    ended: !!lobby.ended,
    groupAvailable: !practice && !!authToken,
  };
  const [selection, setSelection] = useState<LobbyTabSelection | undefined>(
    () => initialTab ? { ...context, tab: initialTab } : undefined,
  );
  const tab = resolveLobbyTab(selection, context);
  const setTab = (value: LobbyTab) => setSelection({ ...context, tab: value });
  const canConfigureAi = canConfigureAiCharacters(lobby, practice);
  const [notesOpen, setNotesOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [haptics, setHaptics] = useState(false);
  const previousFeedback = useRef(lobby.action.feedback);
  useEffect(() => {
    if (
      haptics &&
      lobby.action.feedback &&
      previousFeedback.current !== lobby.action.feedback &&
      Platform.OS !== "web"
    )
      void Haptics.notificationAsync(
        lobby.action.outcome === "rejected" ||
          lobby.action.outcome === "blocked"
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
    previousFeedback.current = lobby.action.feedback;
  }, [lobby.action.feedback, lobby.action.outcome, haptics]);
  const votes = voteSummary(lobby.players, lobby.voteVisibility);
  return (
    <View className="flex-1">
      {!lobby.playerName ? (
        <EmptyState
          title={
            lobby.joining
              ? "Connecting to your lobby"
              : "Connection unavailable"
          }
          description={lobby.joinStatus || "Reserving your seat…"}
          action={
            <View className="gap-2">
              <Button onPress={lobby.joinGame} disabled={lobby.joining}>
                {lobby.joining ? "Connecting…" : "Retry connection"}
              </Button>
              <Button
                variant="outline"
                onPress={onSpectate}
                disabled={spectating}
              >
                Watch game
              </Button>
              <Button variant="outline" onPress={() => onPracticeChange(true)}>
                Practice match
              </Button>
            </View>
          }
        />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
          keyboardVerticalOffset={90}
        >
          <View className="flex-1 gap-2">
            <PhaseHeader lobby={lobby} practice={practice} />
            <ObserverNotice lobby={lobby} />
            {!lobby.connected ? (
              <Text
                accessibilityRole="alert"
                className="text-sm text-destructive"
              >
                Reconnecting… Actions are paused.
              </Text>
            ) : null}
            {lobby.recoveryNotice ? (
              <View className="gap-1 border-b border-border py-2">
                <Text
                  accessibilityRole="alert"
                  className="text-xs text-foreground"
                >
                  {lobby.recoveryNotice}
                </Text>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={lobby.dismissRecovery}
                >
                  Dismiss
                </Button>
              </View>
            ) : null}
            {!lobby.started || practice ? (
              <Button
                variant="outline"
                size="sm"
                onPress={() => onPracticeChange(!practice)}
              >
                {practice ? "Return to lobby" : "Practice match"}
              </Button>
            ) : null}
            <View className="flex-row gap-2">
              {(
                [
                  "chat",
                  "players",
                  ...(!practice && authToken ? ["group"] : []),
                ] as ("chat" | "players" | "group")[]
              ).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  className="flex-1"
                  variant={tab === value ? "primary" : "outline"}
                  accessibilityState={{ selected: tab === value }}
                  onPress={() => setTab(value)}
                >
                  {value === "group"
                    ? "Group"
                    : value === "chat"
                      ? "Chat"
                      : "Players"}
                </Button>
              ))}
            </View>
            {tab === "chat" ? (
              <View className="flex-1 gap-2">
                <View className="flex-row justify-between">
                  <Button
                    size="sm"
                    variant="ghost"
                    accessibilityState={{ checked: muted }}
                    onPress={() => setMuted(!muted)}
                  >
                    {muted ? "Unmute bots" : "Mute bots"}
                  </Button>
                  {Platform.OS !== "web" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      accessibilityState={{ checked: haptics }}
                      onPress={() => setHaptics(!haptics)}
                    >
                      {haptics ? "Haptics on" : "Haptics off"}
                    </Button>
                  ) : null}
                </View>
                <ChatLog messages={lobby.messages} muted={muted} />
                <View className="flex-row items-end gap-2 border-t border-border pt-2">
                  <Input
                    className="min-h-11 max-h-28 flex-1"
                    accessibilityLabel="Message"
                    value={lobby.messageDraft}
                    onChangeText={lobby.setMessageDraft}
                    placeholder={
                      lobby.canTalk
                        ? observer
                          ? "Message spectators…"
                          : "Message the room…"
                        : "Chat unavailable this phase"
                    }
                    editable={lobby.canTalk && lobby.connected}
                    multiline
                    maxLength={150}
                  />
                  <Button
                    onPress={lobby.sendMessage}
                    disabled={
                      !lobby.connected ||
                      !lobby.canTalk ||
                      !lobby.messageDraft.trim()
                    }
                  >
                    Send
                  </Button>
                </View>
              </View>
            ) : tab === "players" ? (
              <ScrollView
                className="flex-1"
                keyboardShouldPersistTaps="handled"
                contentContainerClassName="pb-3"
              >
                <MatchRecapPanel
                  lobby={lobby}
                  onReady={lobby.readyForRematch}
                />
                <View className="border-b border-border py-2">
                  <Button
                    variant="ghost"
                    className="justify-start px-0"
                    accessibilityState={{ expanded: notesOpen }}
                    onPress={() => setNotesOpen(!notesOpen)}
                  >
                    Private notes{notesOpen ? " −" : " +"}
                  </Button>
                  <View className={notesOpen ? "pt-2" : "hidden"}>
                    <PrivateNotesPanel
                      lobby={lobby}
                      ownerId={authToken ? authIdentity(authToken) : undefined}
                    />
                  </View>
                </View>
                <RoleReference
                  name={lobby.currentUserRole}
                  capability={lobby.visitCapability}
                />
                <View className="flex-row items-center justify-between gap-2 py-3">
                  <Text className="font-semibold text-foreground">
                    Players ({lobby.players.length})
                  </Text>
                  {canConfigureAi ? (
                    <AiCharactersSetup roomId={roomId} />
                  ) : null}
                  {lobby.time === "Day" && lobby.started && !lobby.ended ? (
                    <Text className="text-xs text-muted-foreground">
                      {votes
                        ? `${votes.required} votes to eliminate`
                        : "Votes hidden"}
                    </Text>
                  ) : null}
                </View>
                {lobby.players.map((player, index) => (
                  <GamePlayerRow
                    key={player.name}
                    player={player}
                    index={index}
                    lobby={lobby}
                  />
                ))}
              </ScrollView>
            ) : (
              <ScrollView
                className="flex-1"
                keyboardShouldPersistTaps="handled"
              >
                <LobbyGroupPanel
                  roomId={roomId}
                  onFollowRoom={(nextRoom) =>
                    onFollowRoom?.(nextRoom)
                  }
                />
              </ScrollView>
            )}
            <View className="gap-2 border-t border-border pt-2">
              <Text
                accessibilityRole="alert"
                className={`text-xs ${lobby.action.outcome === "rejected" || lobby.action.outcome === "blocked" ? "text-destructive" : "text-muted-foreground"}`}
              >
                {observer
                  ? "Spectator chat"
                  : (!lobby.ended && lobby.action.feedback) ||
                    phaseActionHint({
                      time: lobby.time,
                      capability: lobby.visitCapability,
                      started: lobby.started,
                      ended: lobby.ended,
                      canVote: lobby.canVote,
                      actorAlive:
                        lobby.players.find(
                          (player) => player.name === lobby.playerName,
                        )?.isAlive !== false,
                    })}
              </Text>
              {!lobby.ended && lobby.action.vote !== undefined ? (
                <Text className="text-xs text-foreground">
                  {lobby.action.vote === null
                    ? "Abstained"
                    : `Your vote: ${lobby.action.vote}`}
                </Text>
              ) : null}
              <View className="flex-row gap-2">
                {!observer &&
                tab !== "players" &&
                lobby.started &&
                !lobby.ended &&
                (shouldShowVisitAction(lobby.time, lobby.visitCapability) ||
                  (lobby.canVote &&
                    (lobby.time === "Day" ||
                      lobby.visitCapability.nightVote))) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => setTab("players")}
                  >
                    Your action
                  </Button>
                ) : null}
                {!observer &&
                lobby.action.visit &&
                !lobby.ended &&
                lobby.action.outcome === "submitted" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={lobby.cancelVisit}
                    disabled={!lobby.connected}
                  >
                    Cancel action
                  </Button>
                ) : null}
                {lobby.started &&
                !lobby.ended &&
                lobby.time === "Day" &&
                lobby.canVote &&
                lobby.action.vote === undefined ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => lobby.voteForPlayer(null)}
                    disabled={!lobby.connected}
                  >
                    Abstain
                  </Button>
                ) : null}
                {practice && lobby.time === "Night" && lobby.action.visit ? (
                  <Button size="sm" onPress={lobby.advancePractice}>
                    Continue to day
                  </Button>
                ) : null}
              </View>
              {practice && !lobby.ended ? (
                <Text className="text-xs text-muted-foreground">
                  {lobby.time === "Night"
                    ? "Protect Mira, then continue to the day discussion."
                    : "Read Mira's clue, then vote for the player you suspect."}
                </Text>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
