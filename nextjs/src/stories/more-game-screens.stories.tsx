import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Activity,
  Clock3,
  Crown,
  Eye,
  Gavel,
  HeartPulse,
  Search,
  Shield,
  Skull,
  Swords,
  Target,
  Trophy,
  UserRound,
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
  title: "Samples/More Game Screens",
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <main className="bg-background text-foreground min-h-screen p-8">
        <div className="mx-auto max-w-5xl">
          <Story />
        </div>
      </main>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const votingPlayers = [
  { name: "Mira", votes: 3, status: "Accused" },
  { name: "Theo", votes: 2, status: "Speaking" },
  { name: "Jules", votes: 1, status: "Silent" },
  { name: "Nadia", votes: 0, status: "Silent" },
];

export const Matchmaking: Story = {
  render: () => (
    <div className="flex min-h-[700px] items-center justify-center">
      <Card className="w-full max-w-xl text-center">
        <CardHeader className="items-center">
          <div className="bg-primary/15 text-primary mb-5 rounded-full p-5">
            <Search className="size-12" />
          </div>
          <Badge variant="secondary" className="gap-1">
            <Activity className="size-3" /> Searching
          </Badge>
          <CardTitle className="mt-3 text-3xl">Finding a match</CardTitle>
          <CardDescription>
            Looking for players near your skill level.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="bg-secondary rounded-xl p-6">
            <p className="text-muted-foreground text-sm">Time elapsed</p>
            <p className="mt-1 text-4xl font-bold tabular-nums">00:37</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <strong className="block text-lg">8</strong>
              <span className="text-muted-foreground">Players</span>
            </div>
            <div className="rounded-lg border p-3">
              <strong className="block text-lg">Classic</strong>
              <span className="text-muted-foreground">Mode</span>
            </div>
            <div className="rounded-lg border p-3">
              <strong className="block text-lg">Any</strong>
              <span className="text-muted-foreground">Region</span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full">
            Cancel search
          </Button>
        </CardFooter>
      </Card>
    </div>
  ),
};

export const DayVoting: Story = {
  render: () => (
    <div className="grid gap-6">
      <header className="flex items-end justify-between">
        <div>
          <Badge variant="outline">Day 3</Badge>
          <h1 className="mt-2 text-3xl font-bold">Town vote</h1>
          <p className="text-muted-foreground mt-1">
            Vote to place a player on trial.
          </p>
        </div>
        <div className="text-primary flex items-center gap-2 text-xl font-semibold">
          <Clock3 /> 00:42
        </div>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel /> Cast your vote
          </CardTitle>
          <CardDescription>
            Four votes are required for a majority.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {votingPlayers.map((player, index) => (
            <button
              key={player.name}
              className={`grid grid-cols-[1fr_auto_auto] items-center gap-6 rounded-lg border p-4 text-left ${index === 0 ? "border-primary bg-primary/10" : "hover:bg-accent"}`}
            >
              <span className="font-medium">{player.name}</span>
              <span className="text-muted-foreground text-sm">
                {player.votes} {player.votes === 1 ? "vote" : "votes"}
              </span>
              <Badge variant={index === 0 ? "default" : "secondary"}>
                {player.status}
              </Badge>
            </button>
          ))}
        </CardContent>
        <CardFooter className="justify-between">
          <p className="text-muted-foreground text-sm">Your vote: Mira</p>
          <Button>Confirm vote</Button>
        </CardFooter>
      </Card>
    </div>
  ),
};

export const PlayerProfile: Story = {
  render: () => (
    <div className="grid gap-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 p-8 sm:flex-row">
          <div className="bg-primary/15 text-primary flex size-24 items-center justify-center rounded-full">
            <UserRound className="size-12" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-3xl font-bold">NightOwl</h1>
              <Badge>Level 27</Badge>
            </div>
            <p className="text-muted-foreground mt-2">
              Playing since March 2025
            </p>
          </div>
          <Button variant="outline">Edit profile</Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6 text-center">
            <Trophy className="text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold">64%</p>
            <p className="text-muted-foreground text-sm">Win rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <Swords className="text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold">128</p>
            <p className="text-muted-foreground text-sm">Games played</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <Crown className="text-primary mx-auto mb-2" />
            <p className="text-3xl font-bold">14</p>
            <p className="text-muted-foreground text-sm">MVP awards</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Favourite roles</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="bg-secondary rounded-lg p-4">
            <Shield className="mb-3" />
            <strong>Doctor</strong>
            <p className="text-muted-foreground text-sm">31 games</p>
          </div>
          <div className="bg-secondary rounded-lg p-4">
            <Eye className="mb-3" />
            <strong>Investigator</strong>
            <p className="text-muted-foreground text-sm">24 games</p>
          </div>
          <div className="bg-secondary rounded-lg p-4">
            <Skull className="mb-3" />
            <strong>Godfather</strong>
            <p className="text-muted-foreground text-sm">18 games</p>
          </div>
        </CardContent>
      </Card>
    </div>
  ),
};

export const GameSettings: Story = {
  render: () => (
    <div className="grid gap-6">
      <header>
        <h1 className="text-3xl font-bold">Create custom game</h1>
        <p className="text-muted-foreground mt-1">
          Configure the room before inviting players.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Room settings</CardTitle>
            <CardDescription>
              These settings cannot be changed once the game begins.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="room-name">Room name</Label>
              <Input id="room-name" defaultValue="Friday Night Mafia" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="capacity">Player capacity</Label>
                <Input id="capacity" type="number" defaultValue="10" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="discussion">Discussion time</Label>
                <Input id="discussion" defaultValue="90 seconds" />
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Anonymous voting</p>
                <p className="text-muted-foreground text-sm">
                  Hide individual votes until the result.
                </p>
              </div>
              <Badge variant="secondary">Off</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Role reveal on death</p>
                <p className="text-muted-foreground text-sm">
                  Show eliminated player roles.
                </p>
              </div>
              <Badge>On</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Composition</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex justify-between">
              <span>Town</span>
              <Badge>6</Badge>
            </div>
            <div className="flex justify-between">
              <span>Mafia</span>
              <Badge variant="destructive">3</Badge>
            </div>
            <div className="flex justify-between">
              <span>Neutral</span>
              <Badge variant="secondary">1</Badge>
            </div>
            <Separator />
            <p className="text-muted-foreground text-sm">
              10 roles assigned to 10 available slots.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Create lobby</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  ),
};

const roles = [
  {
    name: "Doctor",
    faction: "Town",
    description: "Protect one player from an attack each night.",
    icon: HeartPulse,
  },
  {
    name: "Investigator",
    faction: "Town",
    description: "Learn clues about another player's alignment.",
    icon: Eye,
  },
  {
    name: "Godfather",
    faction: "Mafia",
    description: "Lead the Mafia and appear innocent to investigations.",
    icon: Skull,
  },
  {
    name: "Sniper",
    faction: "Neutral",
    description: "Eliminate marked targets while remaining undetected.",
    icon: Target,
  },
];

export const RoleReference: Story = {
  render: () => (
    <div className="grid gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold">Role reference</h1>
          <p className="text-muted-foreground mt-1">
            Learn each role before entering a match.
          </p>
        </div>
        <Input className="sm:w-72" placeholder="Search roles…" />
      </header>
      <div className="flex gap-2">
        <Button size="sm">All roles</Button>
        <Button size="sm" variant="outline">
          Town
        </Button>
        <Button size="sm" variant="outline">
          Mafia
        </Button>
        <Button size="sm" variant="outline">
          Neutral
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => (
          <Card key={role.name}>
            <CardHeader className="flex-row items-start gap-4 space-y-0">
              <div className="bg-secondary rounded-lg p-3">
                <role.icon />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>{role.name}</CardTitle>
                  <Badge
                    variant={
                      role.faction === "Mafia"
                        ? "destructive"
                        : role.faction === "Neutral"
                          ? "secondary"
                          : "default"
                    }
                  >
                    {role.faction}
                  </Badge>
                </div>
                <CardDescription className="mt-2">
                  {role.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardFooter>
              <Button variant="ghost" size="sm">
                View abilities
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  ),
};
