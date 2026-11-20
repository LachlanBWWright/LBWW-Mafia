import { useEffect, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { StackParamList } from "../App";
import { authIdentity } from "../lib/authIdentity";
import { useAppState } from "../context/AppStateContext";
import { Button, Screen } from "../components/ui";
import { LobbyView } from "../components/LobbyView";
import { MotionPreferenceContext } from "../components/MotionPreference";
import { trpcClient } from "../lib/trpc";
import { useGameLobby } from "../lib/useGameLobby";
import { Text, View } from "react-native";
import { GameSetupSummary } from "../components/GameSetupSummary";
import {
  requestLobbyPreview,
  type LobbyPreview,
} from "../../shared/game/lobbyPreview";

function ConnectedLobbyScreen({
  navigation,
  route,
  initialPractice = false,
}: NativeStackScreenProps<StackParamList, "Lobby"> & {
  initialPractice?: boolean;
}) {
  const { setPlayerName, setLastRoomName, authToken } = useAppState();
  const roomId =
    route.params?.roomId ??
    process.env.EXPO_PUBLIC_PARTYSERVER_ROOM ??
    "default";
  const [practice, setPractice] = useState(initialPractice);
  const [reducedMotion, setReducedMotion] = useState(Boolean(authToken));
  useEffect(() => {
    let active = true;
    if (!authToken) return;
    void trpcClient.account.profile.query().then((profile) => { if (active) setReducedMotion(profile.reducedMotion); }).catch(() => { if (active) setReducedMotion(false); });
    return () => { active = false; };
  }, [authToken]);
  const [watchChoice, setWatchChoice] = useState<{
    routeKey: string;
    value: boolean;
  }>();
  const routeKey = `${roomId}:${route.params?.spectator ?? false}`;
  const spectating =
    watchChoice?.routeKey === routeKey
      ? watchChoice.value
      : (route.params?.spectator ?? false);
  const lobby = useGameLobby(
    roomId,
    practice,
    spectating ? "spectator" : "player",
    authToken ? authIdentity(authToken) : "guest",
  );
  useEffect(() => {
    if (lobby.playerName.trim() && !practice) {
      setPlayerName(lobby.playerName);
      setLastRoomName(roomId);
    }
  }, [lobby.playerName, roomId, practice, setLastRoomName, setPlayerName]);
  return (
    <Screen
      navigation={navigation}
      activeRoute="Lobby"
      title="Lobby"
      scroll={false}
    >
      <MotionPreferenceContext.Provider value={!!authToken && reducedMotion}><LobbyView
        lobby={lobby}
        roomId={roomId}
        practice={practice}
        onPracticeChange={setPractice}
        spectating={spectating}
        onSpectate={() => setWatchChoice({ routeKey, value: true })}
        authToken={authToken ?? undefined}
        onFollowRoom={(nextRoom) => navigation.setParams({ roomId: nextRoom })}
        onLeaveLobby={() => navigation.navigate("Home")}
      /></MotionPreferenceContext.Provider>
    </Screen>
  );
}

type LobbyProps = NativeStackScreenProps<StackParamList, "Lobby">;
const previewBaseUrl =
  process.env.EXPO_PUBLIC_TRPC_URL?.replace(/\/api\/trpc\/?$/, "") ??
  "http://localhost:3000";
export function LobbyScreen(props: LobbyProps) {
  const roomId =
    props.route.params?.roomId ??
    process.env.EXPO_PUBLIC_PARTYSERVER_ROOM ??
    "default";
  return (
    <LobbyEntry
      key={`${roomId}:${props.route.params?.spectator ?? false}:${props.route.params?.practice ?? false}`}
      {...props}
      roomId={roomId}
    />
  );
}
function LobbyEntry(props: LobbyProps & { roomId: string }) {
  const [preview, setPreview] = useState<LobbyPreview | null | undefined>(
    props.route.params?.roomId ? undefined : null,
  );
  const [failed, setFailed] = useState(false);
  const [joined, setJoined] = useState(false);
  const [practice, setPractice] = useState(Boolean(props.route.params?.practice));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!props.route.params?.roomId) return;
    const controller = new AbortController();
    setFailed(false);
    void requestLobbyPreview(props.roomId, previewBaseUrl, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setPreview(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [props.roomId, props.route.params?.roomId, attempt]);
  if (preview === null || joined || practice)
    return <ConnectedLobbyScreen {...props} initialPractice={practice} />;
  return (
    <Screen
      navigation={props.navigation}
      activeRoute="Lobby"
      title="Game setup"
    >
      <View className="gap-4">
        {failed ? (
          <>
            <Text accessibilityRole="alert" className="text-destructive">
              Unable to load this game’s setup. Please try again.
            </Text>
            <Button onPress={() => setAttempt((value) => value + 1)}>
              Retry setup
            </Button>
            <Button variant="outline" onPress={() => setPractice(true)}>
              Practice match
            </Button>
          </>
        ) : preview ? (
          <>
            <Text className="text-foreground">{preview.size} players</Text>
            <GameSetupSummary setup={preview.setup} />
            <Button onPress={() => setJoined(true)}>
              {props.route.params?.spectator ? "Watch match" : "Join match"}
            </Button>
          </>
        ) : (
          <Text accessibilityLiveRegion="polite" className="text-foreground">
            Loading game setup…
          </Text>
        )}
      </View>
    </Screen>
  );
}
