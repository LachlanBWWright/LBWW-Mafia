import { memo, useContext, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  ScrollView,
  Pressable,
  Text,
  View,
} from "react-native";
import { Moon, Sun, Skull, Sparkles, Trophy } from "lucide-react-native";
import type { LobbyState } from "../../shared/game/lobbyState";
import {
  formatClock,
  roleActionRestrictions,
  roleReference,
  visibleMessages,
  type LobbyMessage,
} from "../../shared/game/matchExperience";
import {
  chatMessagePresentation,
  chatEventStyle,
  lobbyPhaseLabel,
} from "../../shared/game/lobbyPresentation";
import type { VisitCapability } from "../../shared/game/playerActionRules";
import { Button } from "./ui";
import { RoleIcon } from "./RoleIcon";
import { PlayerAvatar } from "./PlayerAvatar";
import { MotionPreferenceContext } from "./MotionPreference";

function useReducedMotion() {
  const accountPreference = useContext(MotionPreferenceContext);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced || accountPreference;
}

function EventRow({ message, event, animate, reduced }: { message: LobbyMessage; event: ReturnType<typeof chatEventStyle>; animate: boolean; reduced: boolean }) {
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animate || reduced) { fade.setValue(1); return; }
    fade.setValue(0);
    const animation = Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [animate, reduced, fade]);
  const Icon = event === "phase-day" ? Sun : event === "phase-night" ? Moon : event === "death" ? Skull : event === "outcome" ? Trophy : Sparkles;
  const border = event === "phase-day" ? "border-amber-500" : event === "phase-night" ? "border-indigo-400" : event === "death" ? "border-rose-400" : event === "outcome" ? "border-amber-400" : "border-primary";
  return <Animated.View style={{ opacity: fade }}><View testID={`chat-event-${event}`} accessibilityLiveRegion={animate ? "polite" : "none"} className={`mt-3 flex-row items-start gap-2 border-l-2 bg-muted px-3 py-2 ${border}`}><Icon size={16} color={event === "death" ? "#D46778" : event === "phase-night" ? "#8D9EEF" : event === "result" ? "#5B8CFF" : "#D49B35"} /><Text className={`flex-1 text-sm leading-5 text-foreground ${event === "death" || event === "outcome" ? "font-semibold" : ""}`}>{message.text}</Text></View></Animated.View>;
}

export function PhaseHeader({
  lobby,
  practice,
  onRolePress,
}: {
  lobby: LobbyState;
  practice?: boolean;
  onRolePress?: () => void;
}) {
  const fade = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (reducedMotion) { fade.setValue(1); return; }
    fade.setValue(0.4);
    const animation = Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [lobby.time, lobby.dayNumber, fade, reducedMotion]);
  const animation = { opacity: fade };
  const night = lobby.time === "Night";
  const phase = lobby.started && !lobby.ended ? `${lobby.matchId ?? ""}:${lobby.time}:${lobby.dayNumber}` : "";
  const previousPhase = useRef(phase);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const previous = previousPhase.current;
    previousPhase.current = phase;
    if (!phase) { const clear = setTimeout(() => setAnnouncement(""), 0); return () => clearTimeout(clear); }
    if (!previous || previous === phase) return;
    const show = setTimeout(() => setAnnouncement(`${lobby.time} ${lobby.dayNumber} begins`), 0);
    const hide = setTimeout(() => setAnnouncement(""), 2400);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [phase, lobby.time, lobby.dayNumber]);
  return (
    <>
    <View
      className={`relative flex-row items-center justify-between gap-3 border-b border-l-2 px-3 py-2 ${night ? "border-indigo-400/50 bg-indigo-400/5" : "border-amber-400/50 bg-amber-400/5"}`}
    >
      <View className="flex-1 flex-row items-center gap-3">
        {night ? (
          <Moon size={22} color="#A5B4FC" />
        ) : (
          <Sun size={22} color="#FBBF24" />
        )}
        <View className="flex-1">
          <Animated.View style={animation}>
            <Text accessibilityLiveRegion="polite" className="text-xl font-semibold text-foreground">
              {lobbyPhaseLabel(lobby)}
            </Text>
          </Animated.View>
          <View className="flex-row flex-wrap items-center gap-1">
            <Text className="text-xs text-muted-foreground">{lobby.playerName}</Text>
            {lobby.currentUserRole ? <><Text className="text-xs text-muted-foreground">·</Text><RoleIcon role={lobby.currentUserRole} size={14} />{onRolePress ? <Pressable accessibilityRole="button" accessibilityLabel={`Your role: ${lobby.currentUserRole}`} onPress={onRolePress}><Text className="text-xs text-muted-foreground underline">{lobby.currentUserRole}</Text></Pressable> : <Text className="text-xs text-muted-foreground">{lobby.currentUserRole}</Text>}</> : null}
            {practice ? <Text className="text-xs text-muted-foreground">· Practice</Text> : null}
          </View>
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
    {announcement ? <View testID="phase-announcement" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="border-b border-border bg-muted px-3 py-1"><Text className="text-sm font-semibold text-foreground">{announcement}</Text></View> : null}
    </>
  );
}
export function RoleReference({
  name,
  capability,
  expanded: controlled,
  onExpandedChange,
  customRoles,
}: {
  name?: string;
  capability: VisitCapability;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  customRoles?: NonNullable<LobbyState["setup"]>["customRoles"];
}) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlled ?? localExpanded;
  const role = roleReference(name, customRoles);
  if (!role) return null;
  return (
    <View className="gap-2 border-b border-border py-3">
      <Button
        variant="ghost"
        className="justify-start px-0"
        onPress={() => onExpandedChange ? onExpandedChange(!expanded) : setLocalExpanded(!expanded)}
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
  const reducedMotion = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const hasRecap = Boolean(lobby.recap);
  useEffect(() => {
    if (!hasRecap || reducedMotion) { fade.setValue(1); return; }
    fade.setValue(0);
    const animation = Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [hasRecap, reducedMotion, fade]);
  if (!lobby.recap) return null;
  const ready = lobby.readyPlayers?.includes(lobby.playerName);
  return (
    <Animated.View style={{ opacity: fade }}>
    <View
      className="gap-3 border-b border-l-2 border-amber-400 py-4 pl-3"
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
    </Animated.View>
  );
}
export const ChatLog = memo(function ChatLogContent({
  messages,
  muted,
  compact = false,
  onPlayerSelect,
  playerNames = [],
  anonymous = true,
  jumpSignal = 0,
}: {
  messages: LobbyMessage[];
  muted: boolean;
  compact?: boolean;
  onPlayerSelect?: (name: string) => void;
  playerNames?: readonly string[];
  anonymous?: boolean;
  jumpSignal?: number;
}) {
  const ref = useRef<ScrollView>(null);
  const [initialMessages] = useState(() => new Set(messages.map((message) => message.id)));
  const reducedMotion = useReducedMotion();
  const nearBottom = useRef(true);
  const [paused, setPaused] = useState(false);
  const [seen, setSeen] = useState(0);
  const filtered = visibleMessages(messages, muted);
  const unread = paused ? filtered.filter((message) => message.id > seen).length : 0;
  useEffect(() => { if (jumpSignal) ref.current?.scrollToEnd({ animated: true }); }, [jumpSignal]);
  return (
    <View className="relative min-h-0 flex-1">
    <ScrollView
      ref={ref}
      className="flex-1"
      contentContainerClassName="pb-3"
      keyboardShouldPersistTaps="handled"
      onScroll={(event) => {
        const { contentOffset, contentSize, layoutMeasurement } =
          event.nativeEvent;
        const bottom = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
        if (nearBottom.current && !bottom) setSeen(filtered.at(-1)?.id ?? 0);
        if (bottom !== nearBottom.current) setPaused(!bottom);
        nearBottom.current = bottom;
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
            : "No messages yet."}
        </Text>
      ) : (
        filtered.map((message, index) => {
          const { grouped, text } = chatMessagePresentation(
            message,
            filtered[index - 1],
          );
          const event = chatEventStyle(message);
          if (event !== "ordinary" && event !== "vote") return <EventRow key={message.id} message={message} event={event} animate={!initialMessages.has(message.id)} reduced={reducedMotion} />;
          return (
            <View
              key={message.id}
              className={`${message.kind === "system" && compact ? "mt-1" : grouped ? "pt-1" : "mt-3 pt-2"} ${message.kind === "system" && !compact && event !== "vote" ? "border-t border-border" : message.kind === "whisper" ? "border-l-2 border-primary/40 pl-3" : ""}`}
            >
              {message.kind === "chat" && message.sender && !grouped ? (
                <View className="mb-1 flex-row items-center gap-2">
                  <PlayerAvatar name={message.sender} anonymous={anonymous} />
                  {onPlayerSelect && playerNames.includes(message.sender) ? <Pressable accessibilityRole="button" accessibilityLabel={`Show player ${message.sender}`} onPress={() => onPlayerSelect(message.sender!)}><Text className="text-sm font-semibold text-foreground">{message.sender}</Text></Pressable> : <Text className="text-sm font-semibold text-foreground">{message.sender}</Text>}
                  {message.isBot ? <Text className="text-xs text-muted-foreground">Bot</Text> : null}
                </View>
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
    {unread > 0 ? <Pressable accessibilityRole="button" className="absolute bottom-3 right-3 rounded-md border border-border bg-secondary px-3 py-2" onPress={() => { ref.current?.scrollToEnd({ animated: true }); nearBottom.current = true; setPaused(false); setSeen(filtered.at(-1)?.id ?? 0); }}><Text className="text-sm text-foreground">{unread} new {unread === 1 ? "message" : "messages"} ↓</Text></Pressable> : null}
    </View>
  );
});
