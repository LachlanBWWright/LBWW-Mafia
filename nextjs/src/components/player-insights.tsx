"use client";
import { avatarOptions } from "@mernmafia/shared/trpc/accountFeatures";
import { useEffect, useState } from "react";
import Image from "next/image";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type {
  AppRouter,
  PlayerStats,
  AccountProfile,
} from "@mernmafia/shared/trpc/appRouter";
import type { PlayerAchievement } from "@mernmafia/shared/trpc/accountFeatures";
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
  const [client] = useState(() =>
    createTRPCProxyClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
    }),
  );
  const [stats, setStats] = useState(initialStats),
    [achievements, setAchievements] = useState(initialAchievements ?? []),
    [profile, setProfile] = useState(initialProfile),
    [error, setError] = useState("");
  useEffect(() => {
    if (initialStats && initialAchievements && initialProfile) return;
    let active = true;
    void Promise.all([
      client.account.stats.query(),
      client.features.achievements.query(),
      client.account.profile.query(),
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
  }, [client, initialStats, initialAchievements, initialProfile]);
  if (!stats)
    return <p role="status">{error || "Loading player statistics…"}</p>;
  return (
    <section
      className="space-y-6"
      aria-label="Player statistics and achievements"
    >
      {profile ? (
        <div className="flex items-center gap-4">
          {profile.avatarPreset ? (
            <span
              className="text-4xl"
              role="img"
              aria-label={`${profile.avatarPreset} avatar`}
            >
              {emoji[profile.avatarPreset]}
            </span>
          ) : profile.image ? (
            <Image
              src={profile.image}
              alt="Your avatar"
              width={48}
              height={48}
              unoptimized
              className="rounded-full"
            />
          ) : null}
          <div>
            <h2 className="text-xl font-semibold">
              {profile.handle ?? profile.name ?? "Player"}
            </h2>
            {profile.bio ? (
              <p className="text-muted-foreground text-sm">{profile.bio}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Player statistics</h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            ["Games", stats.gamesPlayed],
            ["Wins", stats.wins],
            ["Win rate", `${Math.round(stats.winRate * 100)}%`],
            ["Current streak", stats.currentStreak],
            ["Best streak", stats.bestWinStreak],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground text-sm">{label}</dt>
              <dd className="text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {stats.recentResults?.length ? (
        <div className="space-y-2">
          <h3 className="font-medium">Recent performance</h3>
          <p className="text-sm">
            {Math.round((stats.recentWinRate ?? 0) * 100)}% wins across your
            last {stats.recentResults.length} games.
          </p>
          <p className="text-muted-foreground text-sm">
            Newest first:{" "}
            {stats.recentResults
              .map((won) => (won ? "Win" : "Loss"))
              .join(" · ")}
          </p>
        </div>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2">
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
          <div key={group.title}>
            <h3 className="mb-2 font-medium">{group.title}</h3>
            {group.rows.length ? (
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{group.title} results</caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col">
                      {group.title === "By role" ? "Role" : "Faction"}
                    </th>
                    <th scope="col">Games</th>
                    <th scope="col">Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={row.name} className="border-b">
                      <th scope="row" className="py-2 font-normal capitalize">
                        {row.name}
                      </th>
                      <td>{row.games}</td>
                      <td>{Math.round((row.wins / row.games) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground text-sm">No games yet.</p>
            )}
          </div>
        ))}
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Achievements</h2>
        <ul className="divide-y">
          {achievements.map((a) => (
            <li key={a.id} className="space-y-1 py-3">
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-medium">{a.name}</h3>
                <span className="text-sm">
                  {a.unlocked
                    ? "Unlocked"
                    : `${Math.min(a.progress, a.target)} / ${a.target}`}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">{a.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
