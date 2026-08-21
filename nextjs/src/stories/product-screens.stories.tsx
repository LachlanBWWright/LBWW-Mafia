import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gamepad2,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Skull,
  Trophy,
  Users,
  WifiOff,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";

const meta = {
  title: "Samples/Product Screens",
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <main className="bg-background text-foreground min-h-screen p-8">
        <div className="mx-auto max-w-6xl">
          <Story />
        </div>
      </main>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignIn: Story = {
  render: () => (
    <div className="grid min-h-[720px] overflow-hidden rounded-2xl border lg:grid-cols-2">
      <section className="bg-card flex items-center justify-center p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3">
            <div className="bg-primary rounded-xl p-2">
              <Skull className="text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">MERN Mafia</span>
          </div>
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground mt-2">
            Sign in to rejoin your crew.
          </p>
          <div className="mt-8 grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="player@example.com" />
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between">
                <Label htmlFor="password">Password</Label>
                <button className="text-primary text-sm">
                  Forgot password?
                </button>
              </div>
              <Input id="password" type="password" defaultValue="secretpass" />
            </div>
            <Button className="w-full">
              Sign in <ArrowRight />
            </Button>
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-muted-foreground text-xs">OR</span>
              <Separator className="flex-1" />
            </div>
            <Button variant="outline" className="w-full">
              Continue as guest
            </Button>
          </div>
        </div>
      </section>
      <section className="from-primary/25 via-background to-destructive/20 hidden items-center justify-center bg-gradient-to-br p-12 lg:flex">
        <div className="max-w-md">
          <Badge variant="outline" className="mb-5">
            Trust no one
          </Badge>
          <h2 className="text-5xl leading-tight font-bold">
            Every player has a secret.
          </h2>
          <p className="text-muted-foreground mt-5 text-lg">
            Bluff, investigate, and survive in a social deduction game built for
            your group.
          </p>
        </div>
      </section>
    </div>
  ),
};

const rooms = [
  {
    name: "Sydney Social",
    host: "Mira",
    players: "7/10",
    mode: "Classic",
    ping: "24 ms",
  },
  {
    name: "Quick Chaos",
    host: "Theo",
    players: "6/8",
    mode: "Rapid",
    ping: "41 ms",
  },
  {
    name: "Beginner Friendly",
    host: "Nadia",
    players: "4/12",
    mode: "Casual",
    ping: "56 ms",
  },
  {
    name: "Ranked Night",
    host: "NightOwl",
    players: "9/10",
    mode: "Ranked",
    ping: "62 ms",
  },
];

export const CommunityBrowser: Story = {
  render: () => (
    <div className="grid gap-6">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Badge variant="outline" className="mb-2 gap-1">
            <Radio className="size-3" /> 1,284 online
          </Badge>
          <h1 className="text-3xl font-bold">Community games</h1>
          <p className="text-muted-foreground mt-1">
            Find a public room or start your own.
          </p>
        </div>
        <Button>Create room</Button>
      </header>
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
            <Input className="pl-9" placeholder="Search rooms or hosts…" />
          </div>
          <Button variant="outline">All modes</Button>
          <Button variant="outline">Any region</Button>
        </CardContent>
      </Card>
      <div className="grid gap-4">
        {rooms.map((room, index) => (
          <Card key={room.name}>
            <CardContent className="grid items-center gap-4 p-5 sm:grid-cols-[1fr_auto_auto_auto]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{room.name}</h2>
                  {index === 3 && <Badge variant="destructive">Ranked</Badge>}
                </div>
                <p className="text-muted-foreground text-sm">
                  Hosted by {room.host}
                </p>
              </div>
              <div className="text-sm">
                <Users className="mr-2 inline size-4" />
                {room.players}
              </div>
              <div>
                <Badge variant="secondary">{room.mode}</Badge>
                <span className="text-muted-foreground ml-3 text-xs">
                  {room.ping}
                </span>
              </div>
              <Button size="sm" variant={index === 3 ? "outline" : "default"}>
                {index === 3 ? "Spectate" : "Join"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  ),
};

const matches = [
  {
    result: "Victory",
    role: "Doctor",
    mode: "Classic",
    duration: "18m",
    date: "Today, 8:42 pm",
  },
  {
    result: "Defeat",
    role: "Godfather",
    mode: "Ranked",
    duration: "26m",
    date: "Today, 6:15 pm",
  },
  {
    result: "Victory",
    role: "Investigator",
    mode: "Classic",
    duration: "21m",
    date: "Yesterday",
  },
  {
    result: "Defeat",
    role: "Sniper",
    mode: "Rapid",
    duration: "12m",
    date: "11 Aug 2026",
  },
];

export const MatchHistory: Story = {
  render: () => (
    <div className="grid gap-6">
      <header>
        <h1 className="text-3xl font-bold">Match history</h1>
        <p className="text-muted-foreground mt-1">
          Review your recent games and performance.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <Trophy className="text-primary mb-2" />
            <p className="text-2xl font-bold">67%</p>
            <p className="text-muted-foreground text-sm">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Gamepad2 className="text-primary mb-2" />
            <p className="text-2xl font-bold">42</p>
            <p className="text-muted-foreground text-sm">Matches played</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Clock3 className="text-primary mb-2" />
            <p className="text-2xl font-bold">19m</p>
            <p className="text-muted-foreground text-sm">Average duration</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent matches</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1">
          {matches.map((match) => (
            <div
              key={match.date}
              className="grid items-center gap-3 border-b py-4 last:border-0 sm:grid-cols-[120px_1fr_auto_auto]"
            >
              <Badge
                variant={match.result === "Victory" ? "default" : "destructive"}
              >
                {match.result}
              </Badge>
              <div>
                <p className="font-medium">{match.role}</p>
                <p className="text-muted-foreground text-sm">{match.mode}</p>
              </div>
              <span className="text-muted-foreground text-sm">
                {match.duration}
              </span>
              <span className="text-muted-foreground text-right text-sm">
                {match.date}
              </span>
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full">
            Load more matches
          </Button>
        </CardFooter>
      </Card>
    </div>
  ),
};

export const ConnectionRecovery: Story = {
  render: () => (
    <div className="flex min-h-[720px] items-center justify-center">
      <Card className="border-destructive/50 w-full max-w-lg text-center">
        <CardHeader className="items-center">
          <div className="bg-destructive/15 text-destructive mb-4 rounded-full p-5">
            <WifiOff className="size-12" />
          </div>
          <Badge variant="destructive">Disconnected</Badge>
          <CardTitle className="mt-3 text-3xl">Connection lost</CardTitle>
          <CardDescription>
            We could not reach the game server. Your seat is reserved while we
            reconnect.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="bg-secondary rounded-lg p-4">
            <div className="flex items-center justify-between text-sm">
              <span>Reconnecting</span>
              <span className="font-medium tabular-nums">Attempt 2 of 5</span>
            </div>
            <div className="bg-background mt-3 h-2 overflow-hidden rounded-full">
              <div className="bg-primary h-full w-2/3 rounded-full" />
            </div>
          </div>
          <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
            <RefreshCw className="size-4" /> Retrying in 4 seconds
          </div>
        </CardContent>
        <CardFooter className="grid grid-cols-2 gap-3">
          <Button variant="outline">Leave match</Button>
          <Button>Retry now</Button>
        </CardFooter>
      </Card>
    </div>
  ),
};

const activity = [
  {
    icon: ShieldCheck,
    text: "Moderator Mira resolved report #184",
    time: "2 min ago",
  },
  {
    icon: Ban,
    text: "Automated suspension issued to player_442",
    time: "18 min ago",
  },
  {
    icon: KeyRound,
    text: "Admin permissions updated for Theo",
    time: "1 hr ago",
  },
  {
    icon: MessageCircle,
    text: "Community announcement published",
    time: "3 hrs ago",
  },
];

export const AdminDashboard: Story = {
  render: () => (
    <div className="grid gap-6">
      <header className="flex items-end justify-between">
        <div>
          <Badge variant="destructive" className="mb-2 gap-1">
            <LockKeyhole className="size-3" /> Admin
          </Badge>
          <h1 className="text-3xl font-bold">Operations dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Platform health and moderation overview.
          </p>
        </div>
        <Button variant="outline">Export report</Button>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <Users className="text-primary mb-3" />
            <p className="text-2xl font-bold">1,284</p>
            <p className="text-muted-foreground text-sm">Players online</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Gamepad2 className="text-primary mb-3" />
            <p className="text-2xl font-bold">186</p>
            <p className="text-muted-foreground text-sm">Active matches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <AlertTriangle className="text-destructive mb-3" />
            <p className="text-2xl font-bold">12</p>
            <p className="text-muted-foreground text-sm">Open reports</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <BarChart3 className="text-primary mb-3" />
            <p className="text-2xl font-bold">99.98%</p>
            <p className="text-muted-foreground text-sm">Server uptime</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>System status</CardTitle>
            <CardDescription>Live service availability.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {[
              "Authentication",
              "Matchmaking",
              "Realtime games",
              "Database",
            ].map((service) => (
              <div key={service} className="flex items-center justify-between">
                <span>{service}</span>
                <Badge className="gap-1">
                  <CheckCircle2 className="size-3" /> Operational
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {activity.map((item) => (
              <div key={item.text} className="flex gap-3">
                <item.icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="text-sm">{item.text}</p>
                  <p className="text-muted-foreground text-xs">{item.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  ),
};
