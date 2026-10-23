import React, { useState } from "react";
import { Text, View } from "react-native";
import type {
  MatchReplay,
  MatchBalanceSummary,
} from "../../shared/trpc/matchAnalysis";
import {
  filterReplayEvents,
  formatWinRate,
  matchOutcome,
  replayEventLabel,
  REPLAY_FILTERS,
  type ReplayFilter,
} from "../../shared/game/replayPresentation";
import { Button, SectionHeader } from "./ui";

export function MatchReplayView({ replay }: { replay: MatchReplay }) {
  const [filter, setFilter] = useState<ReplayFilter>("all");
  const events = filterReplayEvents(replay.events, filter);
  return (
    <View className="gap-5">
      <SectionHeader
        title={`Match #${replay.id} replay`}
        subtitle={`${replay.roomName} · ${matchOutcome(replay.winningFaction)}`}
      />
      <View className="gap-2">
        <Text className="text-base font-bold text-foreground">Role reveal</Text>
        {replay.participants.map((player, index) => (
          <View
            key={`${player.username}-${index}`}
            className="flex-row justify-between gap-3"
          >
            <Text className="flex-1 text-sm text-foreground">
              {player.username}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {player.role}
              {player.won ? " · Winner" : ""}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {REPLAY_FILTERS.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={filter === item.value ? "secondary" : "outline"}
            accessibilityState={{ selected: filter === item.value }}
            onPress={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </View>
      {events.length === 0 ? (
        <Text className="text-sm text-muted-foreground">
          No events in this view.
        </Text>
      ) : (
        <View className="border-l border-border pl-4">
          {events.map((event, index) => (
            <View
              key={`${event.time}-${index}`}
              className="gap-1 border-b border-border py-3"
            >
              <View className="flex-row flex-wrap justify-between gap-2">
                <Text className="text-xs text-muted-foreground">
                  {replayEventLabel(event)}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {new Date(event.time).toLocaleTimeString()}
                </Text>
              </View>
              <Text className="text-sm leading-5 text-foreground">
                {event.content}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
export function MatchBalanceView({
  balance,
}: {
  balance: MatchBalanceSummary;
}) {
  return (
    <View className="gap-5">
      <SectionHeader
        title="Game balance"
        subtitle={`${balance.sampleSize} completed matches · ${balance.draws} draws`}
      />
      <Text className="text-sm leading-5 text-muted-foreground">
        Observed results depend on players and settings. Fewer than 20 games is
        a small sample.
      </Text>
      {!balance.sampleSize ? (
        <Text className="text-sm text-muted-foreground">
          No completed matches available yet.
        </Text>
      ) : (
        <>
          <BalanceRows
            title="By final role"
            rows={balance.roles.map((row) => ({ label: row.role, ...row }))}
          />
          <BalanceRows
            title="By final faction"
            rows={balance.factions.map((row) => ({
              label: row.faction,
              ...row,
            }))}
          />
          <View>
            <Text className="mb-2 text-base font-bold text-foreground">
              By composition
            </Text>
            {balance.compositions.map((row, index) => (
              <View key={index} className="gap-1 border-b border-border py-3">
                <Text className="text-sm text-foreground">
                  {row.roles.join(", ")}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {row.games} games · {row.draws} draws
                  {row.games < 20 ? " · Small sample" : ""}
                  {row.roster === "final" ? " · Final roster" : ""}
                </Text>
                <Text className="text-sm text-foreground">
                  {row.wins
                    .map(
                      (result) =>
                        `${result.faction}: ${formatWinRate(result.winRate)} (${result.wins} wins)`,
                    )
                    .join(" · ")}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}
function BalanceRows({
  title,
  rows,
}: {
  title: string;
  rows: {
    label: string;
    games: number;
    wins: number;
    draws: number;
    winRate: number;
  }[];
}) {
  return (
    <View>
      <Text className="mb-2 text-base font-bold text-foreground">{title}</Text>
      {rows.map((row) => (
        <View key={row.label} className="gap-1 border-b border-border py-3">
          <View className="flex-row justify-between gap-3">
            <Text className="text-sm font-bold text-foreground">
              {row.label}
            </Text>
            <Text className="text-sm text-foreground">
              {formatWinRate(row.winRate)}
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground">
            {row.games} games · {row.wins} wins · {row.draws} draws
            {row.games < 20 ? " · Small sample" : ""}
          </Text>
        </View>
      ))}
    </View>
  );
}
