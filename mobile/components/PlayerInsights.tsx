import { avatarOptions } from "../../shared/trpc/accountFeatures";
import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import type { PlayerStats, AccountProfile } from "../../shared/trpc/appRouter";
import type { PlayerAchievement } from "../../shared/trpc/accountFeatures";
import { trpcClient } from "../lib/trpc";
import { SectionHeader } from "./ui";
const emoji: Record<string, string> = Object.fromEntries(
  avatarOptions.map((option) => [option.id, option.symbol]),
);
export function PlayerInsights({
  initialStats,
  initialAchievements,
  initialProfile,
}: {
  initialStats?: PlayerStats;
  initialAchievements?: PlayerAchievement[];
  initialProfile?: AccountProfile;
}) {
  const [stats, setStats] = useState(initialStats),
    [achievements, setAchievements] = useState(initialAchievements ?? []),
    [profile, setProfile] = useState(initialProfile),
    [error, setError] = useState("");
  useEffect(() => {
    if (initialStats && initialAchievements && initialProfile) return;
    let active = true;
    void Promise.all([
      trpcClient.account.stats.query(),
      trpcClient.features.achievements.query(),
      trpcClient.account.profile.query(),
    ])
      .then(([s, a, p]) => {
        if (active) {
          setStats(s);
          setAchievements(a);
          setProfile(p);
        }
      })
      .catch(() => {
        if (active) setError("Unable to load player statistics.");
      });
    return () => {
      active = false;
    };
  }, [initialStats, initialAchievements, initialProfile]);
  if (!stats)
    return (
      <Text accessibilityRole="alert" className="text-foreground">
        {error || "Loading player statistics…"}
      </Text>
    );
  return (
    <View className="gap-5 border-t border-border pt-5">
      {profile ? (
        <View className="flex-row items-center gap-3">
          {profile.avatarPreset ? (
            <Text
              accessibilityLabel={`${profile.avatarPreset} avatar`}
              className="text-4xl"
            >
              {emoji[profile.avatarPreset]}
            </Text>
          ) : profile.image ? (
            <Image
              source={{ uri: profile.image }}
              accessibilityLabel="Your avatar"
              className="h-12 w-12 rounded-full"
            />
          ) : null}
          <View className="flex-1">
            <Text className="text-xl font-bold text-foreground">
              {profile.handle ?? profile.name ?? "Player"}
            </Text>
            {profile.bio ? (
              <Text className="text-sm text-muted-foreground">
                {profile.bio}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      <SectionHeader title="Player statistics" />
      <View className="flex-row flex-wrap gap-4">
        {[
          ["Games", stats.gamesPlayed],
          ["Wins", stats.wins],
          ["Win rate", `${Math.round(stats.winRate * 100)}%`],
          ["Current streak", stats.currentStreak],
          ["Best streak", stats.bestWinStreak],
        ].map(([label, value]) => (
          <View key={label} className="min-w-24 gap-1">
            <Text className="text-sm text-muted-foreground">{label}</Text>
            <Text className="text-2xl font-bold text-foreground">{value}</Text>
          </View>
        ))}
      </View>
      {stats.recentResults?.length ? (
        <View className="gap-2">
          <SectionHeader title="Recent performance" />
          <Text className="text-sm text-foreground">
            {Math.round((stats.recentWinRate ?? 0) * 100)}% wins across your
            last {stats.recentResults.length} games.
          </Text>
          <Text className="text-sm text-muted-foreground">
            Newest first:{" "}
            {stats.recentResults
              .map((won) => (won ? "Win" : "Loss"))
              .join(" · ")}
          </Text>
        </View>
      ) : null}
      {[
        {
          title: "By role",
          rows: stats.roles.map((r) => ({ name: r.role, ...r })),
        },
        {
          title: "By faction",
          rows: stats.factions.map((r) => ({ name: r.faction, ...r })),
        },
      ].map((group) => (
        <View key={group.title} className="gap-2">
          <SectionHeader title={group.title} />
          {group.rows.length ? (
            group.rows.map((row) => (
              <View
                key={row.name}
                className="flex-row flex-wrap justify-between gap-2 border-b border-border py-2"
              >
                <Text className="text-foreground capitalize">{row.name}</Text>
                <Text className="text-sm text-muted-foreground">
                  {row.games} games · {Math.round((row.wins / row.games) * 100)}
                  % wins
                </Text>
              </View>
            ))
          ) : (
            <Text className="text-muted-foreground">No games yet.</Text>
          )}
        </View>
      ))}
      <View className="gap-3">
        <SectionHeader title="Achievements" />
        {achievements.map((a) => (
          <View key={a.id} className="gap-1 border-b border-border pb-3">
            <Text className="font-bold text-foreground">{a.name}</Text>
            <Text className="text-sm text-foreground">
              {a.unlocked
                ? "Unlocked"
                : `${Math.min(a.progress, a.target)} / ${a.target}`}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {a.description}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
