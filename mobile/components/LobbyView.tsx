import { createLobbyLink } from "../../shared/game/lobbyLinks";
import { LobbyDetails } from "./LobbyDetails";
import { LobbyInvites } from "./LobbyInvites";
import { ObserverNotice } from "./ObserverNotice";
import { GameSetupSummary } from "./GameSetupSummary";
import { PrivateNotesPanel } from "./PrivateNotesPanel";
import { LobbyGroupPanel } from "./LobbyGroupPanel";
import { authIdentity } from "../lib/authIdentity";
import { GamePlayerRow } from "./GamePlayerRow";
import { ChatComposer } from "./ChatComposer";
import { ActionIcon } from "./ActionIcon";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import {
  canConfigureAiCharacters,
  phaseActionHint,
  matchActionLabel,
  voteSummary,
} from "../../shared/game/matchExperience";
import { canAbstain, shouldShowVisitAction } from "../../shared/game/playerActionRules";
import { Button, EmptyState } from "./ui";
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
  onLeaveLobby?: () => void;
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
  onLeaveLobby,
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
    () => (initialTab ? { ...context, tab: initialTab } : undefined),
  );
  const tab = resolveLobbyTab(selection, context);
  const setTab = (value: LobbyTab) => setSelection({ ...context, tab: value });
  const canConfigureAi = canConfigureAiCharacters(lobby, practice);
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<string>();
  const [noteNames, setNoteNames] = useState<string[]>([]);
  const [highlighted, setHighlighted] = useState<string>();
  const [roleOpen, setRoleOpen] = useState(false);
  const [roleReturnToChat, setRoleReturnToChat] = useState(false);
  const [chatJump, setChatJump] = useState(0);
  const playersScroll = useRef<ScrollView>(null);
  const playerOffsets = useRef<Record<string, number>>({});
  const pendingPlayer = useRef<string | undefined>(undefined);
  const showPlayer = (name: string) => {
    if (!lobby.players.some((player) => player.name === name)) return;
    setHighlighted(name);
    pendingPlayer.current = name;
    setTab("players");
    const offset = playerOffsets.current[name];
    if (offset !== undefined) requestAnimationFrame(() => playersScroll.current?.scrollTo({ y: offset, animated: true }));
  };
  const showNotes = (name: string) => {
    setNoteTarget(name);
    setNotesOpen(true);
    setTab("players");
    requestAnimationFrame(() => playersScroll.current?.scrollTo({ y: 0, animated: true }));
  };
  const [shareError, setShareError] = useState("");
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
  const votes = voteSummary(lobby.players, lobby.voteVisibility, lobby.setup?.rules.voting.method);
  return (
    <View
      className={`flex-1 ${lobby.setup?.rules.presentation.theme === "noir" ? "bg-[#191715]" : lobby.setup?.rules.presentation.theme === "midnight" ? "bg-[#0e1830]" : ""}`}
    >
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
            <PhaseHeader lobby={lobby} practice={practice} onRolePress={() => { setRoleReturnToChat(tab === "chat"); setRoleOpen(true); setNotesOpen(false); setTab("players"); requestAnimationFrame(() => playersScroll.current?.scrollTo({ y: 0, animated: true })); }} />
            <GameSetupSummary setup={lobby.setup} started={lobby.started} />
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
                <Button variant="ghost" size="sm" onPress={() => { setTab("chat"); setChatJump((value) => value + 1); }}>View recent messages</Button>
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
              <View className="flex-1 gap-2" style={tab === "chat" ? undefined : { display: "none" }} accessibilityElementsHidden={tab !== "chat"} importantForAccessibility={tab === "chat" ? "auto" : "no-hide-descendants"}>
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
                <ChatLog
                  key={`${lobby.matchId}:${!!lobby.started}`}
                  messages={lobby.messages}
                  playerNames={lobby.players.map((player) => player.name)}
                  onPlayerSelect={showPlayer}
                  anonymous={!!lobby.started}
                  jumpSignal={chatJump}
                  muted={false}
                  compact={
                    lobby.setup?.rules.presentation.announcementStyle ===
                    "concise"
                  }
                />
                <ChatComposer value={lobby.messageDraft} onChange={lobby.setMessageDraft} onSend={lobby.sendMessage} players={lobby.players} ownRole={lobby.currentUserRole} disabled={!lobby.canTalk || !lobby.connected} placeholder={lobby.canTalk ? observer ? "Message spectators…" : "Message the room…" : "Chat unavailable this phase"} />
              </View>
            {tab === "players" ? (
              <ScrollView
                ref={playersScroll}
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
                    {noteTarget ? <Button size="sm" variant="ghost" onPress={() => setNoteTarget(undefined)}>Show all players</Button> : null}
                    <PrivateNotesPanel
                      lobby={lobby}
                      ownerId={authToken ? authIdentity(authToken) : undefined}
                      focusPlayer={noteTarget}
                      onBoardChange={setNoteNames}
                    />
                  </View>
                </View>
                <RoleReference
                  name={lobby.currentUserRole}
                  capability={lobby.visitCapability}
                  customRoles={lobby.setup?.customRoles}
                  expanded={roleOpen}
                  onExpandedChange={setRoleOpen}
                />
                {roleOpen && roleReturnToChat ? <Button variant="ghost" size="sm" onPress={() => { setRoleOpen(false); setRoleReturnToChat(false); setTab("chat"); }}>Back to chat</Button> : null}
                <View className="flex-row flex-wrap items-center justify-between gap-2 py-3">
                  <Text className="font-semibold text-foreground">
                    Players ({lobby.players.length}
                    {!lobby.started && lobby.capacity != null
                      ? `/${lobby.capacity}`
                      : ""}
                    )
                  </Text>
                  {!practice && !lobby.started ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        const origin =
                          process.env.EXPO_PUBLIC_WEBSITE_URL ??
                          process.env.EXPO_PUBLIC_TRPC_URL?.replace(
                            /\/api\/trpc\/?$/,
                            "",
                          ) ??
                          "http://localhost:3000";
                        try {
                          const url = createLobbyLink(origin, roomId);
                          void Share.share({ message: url, url }).catch(() =>
                            setShareError("Unable to share lobby link."),
                          );
                        } catch {
                          setShareError("Unable to share lobby link.");
                        }
                      }}
                    >
                      Share lobby
                    </Button>
                  ) : null}
                  {canConfigureAi ? (
                    <AiCharactersSetup roomId={roomId} />
                  ) : null}
                  {lobby.time === "Day" && lobby.started && !lobby.ended ? (
                    <Text className="text-xs text-muted-foreground">
                      {votes
                        ? votes.required ? `${votes.required} votes to eliminate` : "Plurality vote"
                        : "Votes hidden"}
                    </Text>
                  ) : null}
                </View>
                {!practice && !lobby.started ? (
                  <LobbyDetails roomId={roomId} />
                ) : null}
                {!practice && !lobby.started && authToken ? (
                  <LobbyInvites
                    roomId={roomId}
                    authToken={authToken}
                    onClosed={() => onLeaveLobby?.()}
                  />
                ) : null}
                {shareError ? (
                  <Text accessibilityRole="alert" className="text-destructive">
                    {shareError}
                  </Text>
                ) : null}
                {lobby.players.map((player, index) => (
                  <View key={player.name} onLayout={(event) => { const y = event.nativeEvent.layout.y; playerOffsets.current[player.name] = y; if (pendingPlayer.current === player.name) { pendingPlayer.current = undefined; requestAnimationFrame(() => playersScroll.current?.scrollTo({ y, animated: true })); } }}><GamePlayerRow
                    player={player}
                    index={index}
                    lobby={lobby}
                    highlighted={highlighted === player.name}
                    hasNote={noteNames.includes(player.name)}
                    onNotes={showNotes}
                  /></View>
                ))}
              </ScrollView>
            ) : tab === "group" ? (
              <ScrollView
                className="flex-1"
                keyboardShouldPersistTaps="handled"
              >
                <LobbyGroupPanel
                  roomId={roomId}
                  onFollowRoom={(nextRoom) => onFollowRoom?.(nextRoom)}
                />
              </ScrollView>
            ) : null}
            <View className="gap-2 border-t border-border pt-2">
              <Text
                accessibilityRole="alert"
                className={`text-xs ${!lobby.ended && (lobby.action.outcome === "rejected" || lobby.action.outcome === "blocked") ? "border-l-2 border-destructive pl-2 font-medium text-destructive" : "text-muted-foreground"}`}
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
                  <Text>{lobby.action.vote === null
                    ? "Abstained"
                    : `Your vote: ${lobby.action.vote}`}</Text>
                  <Text> · {lobby.time === "Day" && lobby.setup?.rules.voting.allowRevote ? "Can change" : "Final"}</Text>
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
                  onPress={() => { const target = lobby.action.visit ?? lobby.action.vote; if (target) showPlayer(target); else setTab("players"); }}
                  >
                    {matchActionLabel(lobby)}
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
                    <View className="flex-row items-center gap-1"><ActionIcon action="cancel" /><Text className="text-sm font-bold text-foreground">Cancel action</Text></View>
                  </Button>
                ) : null}
                {canAbstain(lobby) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => lobby.voteForPlayer(null)}
                    disabled={!lobby.connected}
                  >
                    <View className="flex-row items-center gap-1"><ActionIcon action="abstain" /><Text className="text-sm font-bold text-foreground">Abstain</Text></View>
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
