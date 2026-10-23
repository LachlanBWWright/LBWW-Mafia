import { memo, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Moon, Sun } from "lucide-react-native";
import type { LobbyState } from "../../shared/game/lobbyState";
import {
  formatClock,
  roleActionRestrictions,
  roleReference,
  visibleMessages,
  type LobbyMessage,
} from "../../shared/game/matchExperience";
import { chatMessagePresentation, lobbyPhaseLabel } from "../../shared/game/lobbyPresentation";
import type { VisitCapability } from "../../shared/game/playerActionRules";
import { Button } from "./ui";

export function PhaseHeader({
  lobby,
  practice,
}: {
  lobby: LobbyState;
  practice?: boolean;
}) {
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted || reduced) return;
      fade.setValue(0.4);
      Animated.timing(fade, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
    return () => {
      mounted = false;
      fade.stopAnimation();
    };
  }, [lobby.time, lobby.dayNumber, fade]);
  const animation = { opacity: fade };
  const night = lobby.time === "Night";
  return (
    <View
      className={`flex-row items-center justify-between gap-3 border-b py-3 ${night ? "border-indigo-400/30" : "border-amber-400/30"}`}
    >
      <View className="flex-1 flex-row items-center gap-3">
        {night ? (
          <Moon size={22} color="#A5B4FC" />
        ) : (
          <Sun size={22} color="#FBBF24" />
        )}
        <View className="flex-1">
          <Animated.View style={animation}>
            <Text className="text-xl font-semibold text-foreground">
              {lobbyPhaseLabel(lobby)}
            </Text>
          </Animated.View>
          <Text className="text-xs text-muted-foreground">
            {lobby.playerName}
            {lobby.currentUserRole ? ` · ${lobby.currentUserRole}` : ""}
            {practice ? " · Practice" : ""}
          </Text>
        </View>
      </View>
      {lobby.started && !lobby.ended && !practice ? (
        <Text
          accessibilityRole="timer"
          className={`font-mono text-2xl ${lobby.timeLeft <= 10 ? "text-destructive" : "text-foreground"}`}
        >
          {formatClock(lobby.timeLeft)}
        </Text>
      ) : null}
    </View>
  );
}
export function RoleReference({
  name,
  capability,
}: {
  name?: string;
  capability: VisitCapability;
}) {
  const [expanded, setExpanded] = useState(false);
  const role = roleReference(name);
  if (!role) return null;
  return (
    <View className="gap-2 border-b border-border py-3">
      <Button
        variant="ghost"
        className="justify-start px-0"
        onPress={() => setExpanded(!expanded)}
        accessibilityState={{ expanded }}
      >
        Your role: {role.name}
        {expanded ? " −" : " +"}
      </Button>
      {expanded ? (
        <>
          <Text className="text-sm text-foreground">{role.objective}</Text>
          <Text className="text-sm leading-5 text-muted-foreground">
            {role.description}
          </Text>
          {roleActionRestrictions(capability).map((restriction) => (
            <Text
              key={restriction}
              className="text-sm leading-5 text-muted-foreground"
            >
              {restriction}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}
export function MatchRecapPanel({
  lobby,
  onReady,
}: {
  lobby: LobbyState;
  onReady: () => void;
}) {
  const [timeline, setTimeline] = useState(false);
  if (!lobby.recap) return null;
  const ready = lobby.readyPlayers?.includes(lobby.playerName);
  return (
    <View
      className="gap-3 border-b border-border py-4"
      accessibilityLabel="Match recap"
    >
      <Text className="text-xl font-semibold text-foreground">
        {lobby.recap.winner === "draw"
          ? "A draw"
          : `${lobby.recap.winner} wins`}
      </Text>
      <Text className="text-sm text-muted-foreground">
        {lobby.recap.reason}
      </Text>
      {lobby.recap.players.map((player) => (
        <View key={player.name} className="flex-row justify-between gap-3">
          <Text className="flex-1 text-sm text-foreground">
            {player.name}
            {player.won ? " · Winner" : ""}
          </Text>
          <Text className="text-sm text-muted-foreground">{player.role}</Text>
        </View>
      ))}
      <Button
        variant="outline"
        accessibilityState={{ expanded: timeline }}
        onPress={() => setTimeline(!timeline)}
      >
        Match timeline{timeline ? " −" : " +"}
      </Button>
      {timeline
        ? lobby.recap.timeline.map((entry) => (
            <Text key={entry.id} className="text-sm text-muted-foreground">
              {entry.phase} {entry.day} · {entry.text}
            </Text>
          ))
        : null}
      <Button
        onPress={onReady}
        disabled={
          ready || !lobby.connected || lobby.participation === "spectator"
        }
      >
        {ready ? "Ready for next match" : "Play again"}
      </Button>
      <Text className="text-xs text-muted-foreground">
        {lobby.readyPlayers?.length ?? 0}/
        {lobby.capacity ?? lobby.players.length} ready
      </Text>
    </View>
  );
}
export const ChatLog = memo(function ChatLog({
  messages,
  muted,
}: {
  messages: LobbyMessage[];
  muted: boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const nearBottom = useRef(true);
  const filtered = visibleMessages(messages, muted);
  return (
    <ScrollView
      ref={ref}
      className="flex-1"
      contentContainerClassName="pb-3"
      keyboardShouldPersistTaps="handled"
      onScroll={(event) => {
        const { contentOffset, contentSize, layoutMeasurement } =
          event.nativeEvent;
        nearBottom.current =
          contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
      }}
      scrollEventThrottle={100}
      onContentSizeChange={() => {
        if (nearBottom.current) ref.current?.scrollToEnd({ animated: false });
      }}
      accessibilityLabel="Game chat"
    >
      {!filtered.length ? (
        <Text className="py-6 text-center text-sm text-muted-foreground">
          {muted && messages.length
            ? "Bot chatter is muted."
            : "The conversation starts here."}
        </Text>
      ) : (
        filtered.map((message, index) => {
          const { grouped, text } = chatMessagePresentation(message, filtered[index - 1]);
          return (
            <View
              key={message.id}
              className={`${grouped ? "pt-1" : "mt-3 pt-2"} ${message.kind === "system" ? "border-t border-border" : message.kind === "whisper" ? "border-l-2 border-primary/40 pl-3" : ""}`}
            >
              {message.kind === "chat" && message.sender && !grouped ? (
                <Text className="mb-1 text-sm font-semibold text-foreground">
                  {message.sender}
                  {message.isBot ? " · Bot" : ""}
                </Text>
              ) : null}
              <Text
                className={`${message.kind === "system" ? "text-xs text-muted-foreground" : message.kind === "whisper" || message.kind === "role" || message.kind === "spectator" ? "text-sm text-primary" : "text-sm text-foreground"} leading-5`}
              >
                {text}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
});
