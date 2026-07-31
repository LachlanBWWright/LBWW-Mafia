"use client";
import { useEffect, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "~/server/trpc/router";
import type { AccountProfile, PlayerStats } from "@mernmafia/shared/trpc/appRouter";
import { Button } from "./ui/button"; import { Input } from "./ui/input"; import { Label } from "./ui/label"; import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const makeClient = () => createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })] });
export function AccountSettings() {
  const [client] = useState(makeClient); const [profile, setProfile] = useState<AccountProfile>(); const [stats, setStats] = useState<PlayerStats>(); const [message, setMessage] = useState("");
  useEffect(() => { void Promise.all([client.account.profile.query(), client.account.stats.query()]).then(([p, s]) => { setProfile(p); setStats(s); }); }, [client]);
  if (!profile) return <p className="text-sm text-muted-foreground">Loading account…</p>;
  async function save(formData: FormData) {
    const field = (name: string) => { const value = formData.get(name); return typeof value === "string" ? value : ""; };
    const updated = await client.account.updateProfile.mutate({ name: field("name"), handle: field("handle"), bio: field("bio"), profileVisibility: field("profileVisibility") as "public" | "friends" | "private", historyVisibility: field("historyVisibility") as "public" | "friends" | "private", theme: field("theme") as "dark" | "light" | "system", reducedMotion: formData.get("reducedMotion") === "on", soundEnabled: formData.get("soundEnabled") === "on", notificationsEnabled: formData.get("notificationsEnabled") === "on" });
    setProfile(updated); setMessage("Settings saved.");
  }
  return <div className="space-y-4">
    <Card><CardHeader><CardTitle>Profile and preferences</CardTitle></CardHeader><CardContent><form action={save} className="grid gap-4 sm:grid-cols-2">
      <div><Label htmlFor="name">Display name</Label><Input id="name" name="name" defaultValue={profile.name ?? ""} /></div>
      <div><Label htmlFor="handle">Unique handle</Label><Input id="handle" name="handle" defaultValue={profile.handle ?? ""} /></div>
      <div className="sm:col-span-2"><Label htmlFor="bio">Bio</Label><Input id="bio" name="bio" defaultValue={profile.bio ?? ""} maxLength={280} /></div>
      <SelectField name="profileVisibility" label="Profile visibility" value={profile.profileVisibility} options={["public", "friends", "private"]} />
      <SelectField name="historyVisibility" label="History visibility" value={profile.historyVisibility} options={["public", "friends", "private"]} />
      <SelectField name="theme" label="Theme" value={profile.theme} options={["dark", "light", "system"]} />
      <div className="space-y-2 pt-2"><Check name="reducedMotion" label="Reduced motion" checked={profile.reducedMotion} /><Check name="soundEnabled" label="Game sound" checked={profile.soundEnabled} /><Check name="notificationsEnabled" label="Notifications" checked={profile.notificationsEnabled} /></div>
      <div className="sm:col-span-2 flex items-center gap-3"><Button type="submit">Save settings</Button><span className="text-sm text-muted-foreground">{message}</span></div>
    </form></CardContent></Card>
    {stats ? <Card><CardHeader><CardTitle>Player statistics</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[["Games", stats.gamesPlayed], ["Wins", stats.wins], ["Win rate", `${Math.round(stats.winRate * 100)}%`], ["Current streak", stats.currentStreak], ["Best streak", stats.bestWinStreak]].map(([label, value]) => <div key={label} className="rounded border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div>)}</CardContent></Card> : null}
  </div>;
}
function SelectField({ name, label, value, options }: { name: string; label: string; value: string; options: string[] }) { return <div><Label htmlFor={name}>{label}</Label><select id={name} name={name} defaultValue={value} className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm">{options.map((option) => <option key={option}>{option}</option>)}</select></div>; }
function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) { return <label className="flex items-center gap-2 text-sm"><input name={name} type="checkbox" defaultChecked={checked} />{label}</label>; }
