import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { StackParamList } from "../App";
import type { CampaignSummary } from "../../shared/trpc/gameCommunity";
import {
  campaignFailure,
  campaignHost,
  setupVoteCounts,
} from "../../shared/game/campaignPresentation";
import { trpcClient } from "../lib/trpc";
import { useAppState } from "../context/AppStateContext";
import { Button, Input, Screen } from "../components/ui";

export function PersistentLobbyDetail({
  lobby,
  busy,
  onRotate,
  onRound,
  onVote,
}: {
  lobby: CampaignSummary;
  busy: boolean;
  onRotate: () => void;
  onRound: (id: number) => void;
  onVote: (code: string) => void;
}) {
  const [matchId, setMatchId] = useState(""),
    [code, setCode] = useState("");
  return (
    <View className="gap-4 border-t border-border pt-6">
      <Text
        accessibilityRole="header"
        className="text-2xl font-bold text-foreground"
      >
        {lobby.name}
      </Text>
      <Text className="text-foreground">
        Current host: {campaignHost(lobby)}
      </Text>
      <Text selectable className="text-foreground">
        Invite code: {lobby.shareCode}
      </Text>
      <Text className="text-lg font-bold text-foreground">Players</Text>
      {lobby.members.map((member) => (
        <Text key={member.userId} className="text-foreground">
          {member.name ?? "Unnamed player"}
          {member.userId === lobby.hostId ? " · Host" : ""}
        </Text>
      ))}
      {lobby.canManage ? (
        <Button disabled={busy} variant="outline" onPress={onRotate}>
          Rotate host
        </Button>
      ) : null}
      <Text className="text-lg font-bold text-foreground">Scoreboard</Text>
      {lobby.scoreboard.length ? (
        lobby.scoreboard.map((row) => (
          <Text key={row.userId} className="text-foreground">
            {row.name ?? "Unnamed player"}: {row.wins} wins · {row.draws} draws
            · {row.games} games
          </Text>
        ))
      ) : (
        <Text className="text-muted-foreground">No completed rounds yet.</Text>
      )}
      <Text className="text-foreground">
        {lobby.rounds.length} completed rounds
        {lobby.rounds.length
          ? `: ${lobby.rounds.map((round) => `#${round.matchId}`).join(", ")}`
          : ""}
      </Text>
      {lobby.canManage ? (
        <>
          <Text className="text-foreground">Completed match number</Text>
          <Input
            accessibilityLabel="Completed match number"
            keyboardType="number-pad"
            value={matchId}
            onChangeText={setMatchId}
          />
          <Button
            disabled={
              busy || !Number.isInteger(Number(matchId)) || Number(matchId) < 1
            }
            onPress={() => onRound(Number(matchId))}
          >
            Add round
          </Button>
        </>
      ) : null}
      <Text className="text-lg font-bold text-foreground">Next setup vote</Text>
      {setupVoteCounts(lobby).map((vote) => (
        <Text key={vote.packCode} className="text-foreground">
          {vote.packCode} · {vote.votes} votes
        </Text>
      ))}
      <Text className="text-foreground">Shared game pack code</Text>
      <Input
        accessibilityLabel="Shared game pack code"
        value={code}
        onChangeText={setCode}
      />
      <Button
        disabled={busy || !code.trim()}
        onPress={() => onVote(code.trim())}
      >
        Vote for setup
      </Button>
    </View>
  );
}
function CampaignContent() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]),
    [selected, setSelected] = useState<CampaignSummary | null>(null),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void trpcClient.community.list
      .query(undefined, { signal: controller.signal })
      .then(setCampaigns)
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) setError(campaignFailure(failure));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, []);
  async function act(operation: () => Promise<CampaignSummary>) {
    setBusy(true);
    setError("");
    try {
      const result = await operation();
      setSelected(result);
      setCampaigns((previous) => [
        result,
        ...previous.filter((item) => item.id !== result.id),
      ]);
    } catch (failure) {
      setError(campaignFailure(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="gap-5">
      <Text className="text-foreground">Lobby name</Text>
      <Input
        accessibilityLabel="Lobby name"
        maxLength={80}
        value={name}
        onChangeText={setName}
      />
      <Button
        disabled={busy || !name.trim()}
        onPress={() =>
          void act(() =>
            trpcClient.community.create.mutate({ name: name.trim() }),
          )
        }
      >
        Create persistent lobby
      </Button>
      <Text className="text-foreground">Invite code</Text>
      <Input
        accessibilityLabel="Invite code"
        autoCapitalize="none"
        value={code}
        onChangeText={setCode}
      />
      <Button
        variant="outline"
        disabled={busy || !/^[a-f0-9]{32}$/.test(code.trim())}
        onPress={() =>
          void act(() =>
            trpcClient.community.join.mutate({ shareCode: code.trim() }),
          )
        }
      >
        Join persistent lobby
      </Button>
      {busy ? (
        <Text accessibilityLiveRegion="polite" className="text-foreground">
          Loading persistent lobbies…
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive">
          {error}
        </Text>
      ) : null}
      <Text className="text-xl font-bold text-foreground">Your persistent lobbies</Text>
      {!busy && !campaigns.length ? (
        <Text className="text-muted-foreground">No persistent lobbies yet.</Text>
      ) : null}
      {campaigns.map((lobby) => (
        <Button
          key={lobby.id}
          disabled={busy}
          variant="ghost"
          onPress={() =>
            void act(() =>
              trpcClient.community.detail.query({ campaignId: lobby.id }),
            )
          }
        >
          {lobby.name}
        </Button>
      ))}
      {selected ? (
        <PersistentLobbyDetail
          key={selected.id}
          lobby={selected}
          busy={busy}
          onRotate={() =>
            void act(() =>
              trpcClient.community.rotateHost.mutate({
                campaignId: selected.id,
              }),
            )
          }
          onRound={(matchId) =>
            void act(() =>
              trpcClient.community.addRound.mutate({
                campaignId: selected.id,
                matchId,
              }),
            )
          }
          onVote={(packCode) =>
            void act(() =>
              trpcClient.community.voteSetup.mutate({
                campaignId: selected.id,
                packCode,
              }),
            )
          }
        />
      ) : null}
    </View>
  );
}
export function CampaignsScreen({
  navigation,
}: NativeStackScreenProps<StackParamList, "Campaigns">) {
  const { authToken } = useAppState();
  return (
    <Screen
      navigation={navigation}
      activeRoute="Campaigns"
      title="Persistent lobbies"
      subtitle="Keep scores across a game night, rotate hosts, and choose the next setup together."
    >
      {authToken ? (
        <CampaignContent key={authToken} />
      ) : (
        <View className="gap-3">
          <Text className="text-foreground">
            Sign in to organise a private game night.
          </Text>
          <Button onPress={() => navigation.navigate("SignIn")}>Sign in</Button>
        </View>
      )}
    </Screen>
  );
}
