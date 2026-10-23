import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Clock3, Crosshair, Shield, Skull, Users, Wifi } from "lucide-react";

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
  title: "Samples/Game Interface",
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

const players = ["Lachlan", "Mira", "Theo", "Jules", "Sam", "Nadia"];

export const ComponentGallery: Story = {
  render: () => (
    <div className="grid gap-8">
      <header>
        <h1 className="text-3xl font-bold">MERN Mafia UI kit</h1>
        <p className="text-muted-foreground mt-2">
          Reusable states and controls for the game interface.
        </p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status badges</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Badge>Ready</Badge>
            <Badge variant="secondary">Waiting</Badge>
            <Badge variant="destructive">Eliminated</Badge>
            <Badge variant="outline">Spectating</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Form controls</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Label htmlFor="gallery-name">Display name</Label>
            <Input id="gallery-name" defaultValue="The Godfather" />
            <Button className="mt-2">Save player</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
};

export const LobbyReady: Story = {
  render: () => (
    <div className="grid gap-6">
      <div className="flex items-end justify-between">
        <div>
          <Badge variant="outline" className="mb-3 gap-1">
            <Wifi /> Connected
          </Badge>
          <h1 className="text-3xl font-bold">Private lobby</h1>
          <p className="text-muted-foreground mt-1">Room code NIGHT-42</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold">6 / 8</p>
          <p className="text-muted-foreground text-sm">players joined</p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users /> Players
          </CardTitle>
          <CardDescription>
            The host can begin when everyone is ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {players.map((player, index) => (
            <div
              key={player}
              className="bg-secondary flex items-center justify-between rounded-lg p-4"
            >
              <span className="font-medium">
                {player}
                {index === 0 && (
                  <span className="text-muted-foreground ml-2 text-xs">
                    HOST
                  </span>
                )}
              </span>
              <Badge variant={index < 5 ? "default" : "secondary"}>
                {index < 5 ? "Ready" : "Waiting"}
              </Badge>
            </div>
          ))}
        </CardContent>
        <CardFooter className="justify-between">
          <Button variant="outline">Copy invite</Button>
          <Button disabled>Waiting for players</Button>
        </CardFooter>
      </Card>
    </div>
  ),
};

export const RoleReveal: Story = {
  render: () => (
    <div className="flex min-h-[700px] items-center justify-center">
      <Card className="border-destructive/60 w-full max-w-lg text-center">
        <CardHeader className="items-center">
          <div className="bg-destructive/15 text-destructive mb-4 rounded-full p-5">
            <Skull className="size-12" />
          </div>
          <Badge variant="destructive">Mafia</Badge>
          <CardTitle className="mt-3 text-4xl">The Godfather</CardTitle>
          <CardDescription>
            Your identity cannot be discovered by investigators.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-6" />
          <p className="text-muted-foreground text-sm">
            Work with the Mafia to eliminate the town. At night, choose one
            player to silence.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="destructive" className="w-full">
            I understand
          </Button>
        </CardFooter>
      </Card>
    </div>
  ),
};

export const NightAction: Story = {
  render: () => (
    <div className="grid gap-6">
      <header className="flex items-center justify-between">
        <div>
          <Badge variant="secondary">Night 2</Badge>
          <h1 className="mt-2 text-3xl font-bold">Choose your target</h1>
        </div>
        <div className="text-primary flex items-center gap-2 text-xl font-semibold">
          <Clock3 /> 00:24
        </div>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair /> Available players
          </CardTitle>
          <CardDescription>
            Your selection locks when the timer reaches zero.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {players.slice(1).map((player, index) => (
            <button
              key={player}
              className={`flex items-center justify-between rounded-lg border p-4 text-left transition-colors ${index === 2 ? "border-primary bg-primary/10" : "hover:bg-accent"}`}
            >
              <span className="font-medium">{player}</span>
              {index === 2 && <Badge>Selected</Badge>}
            </button>
          ))}
        </CardContent>
        <CardFooter className="justify-end gap-3">
          <Button variant="ghost">Skip action</Button>
          <Button>Confirm target</Button>
        </CardFooter>
      </Card>
    </div>
  ),
};

export const MatchSummary: Story = {
  render: () => (
    <div className="grid gap-6">
      <div className="text-center">
        <div className="bg-primary/15 text-primary mx-auto mb-4 w-fit rounded-full p-5">
          <Shield className="size-12" />
        </div>
        <Badge>Town victory</Badge>
        <h1 className="mt-3 text-4xl font-bold">The town is safe</h1>
        <p className="text-muted-foreground mt-2">
          All Mafia members were eliminated after 7 rounds.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Final standings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {players.map((player, index) => (
            <div
              key={player}
              className="flex items-center justify-between border-b py-3 last:border-0"
            >
              <div>
                <span className="mr-3 text-sm tabular-nums">#{index + 1}</span>
                <span className="font-medium">{player}</span>
              </div>
              <Badge variant={index < 4 ? "default" : "destructive"}>
                {index < 4 ? "Town" : "Mafia"}
              </Badge>
            </div>
          ))}
        </CardContent>
        <CardFooter className="justify-center gap-3">
          <Button variant="outline">View history</Button>
          <Button>Play again</Button>
        </CardFooter>
      </Card>
    </div>
  ),
};
