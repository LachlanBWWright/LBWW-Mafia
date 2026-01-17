import { Header } from "~/components/header";
import { Footer } from "~/components/footer";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export default function LobbyPage() {
  // Mock data for available games
  const publicGames = [
    { id: 1, name: "Game #1", players: 8, maxPlayers: 13, host: "Player1", status: "Waiting" },
    { id: 2, name: "Game #2", players: 12, maxPlayers: 13, host: "Player2", status: "Starting" },
    { id: 3, name: "Game #3", players: 5, maxPlayers: 10, host: "Player3", status: "Waiting" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <div className="container mx-auto flex-1 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Game <span className="text-primary">Lobby</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Join an existing game or create your own
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Create Game Section */}
            <div className="lg:col-span-1">
              <Card className="sticky top-20">
                <CardHeader>
                  <CardTitle className="text-2xl">Create New Game</CardTitle>
                  <CardDescription>
                    Start your own game room
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Your Username
                    </label>
                    <input
                      type="text"
                      placeholder="Enter username"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Room Name
                    </label>
                    <input
                      type="text"
                      placeholder="My Awesome Game"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Max Players
                    </label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="5">5 Players</option>
                      <option value="7">7 Players</option>
                      <option value="10">10 Players</option>
                      <option value="13">13 Players</option>
                      <option value="15">15 Players</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="private"
                      className="h-4 w-4 rounded border-input"
                    />
                    <label htmlFor="private" className="text-sm font-medium">
                      Private Game
                    </label>
                  </div>
                  <Button className="w-full" size="lg">
                    Create Game
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Public Games List */}
            <div className="lg:col-span-2">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">Public Games</h2>
                <Button variant="outline" size="sm">
                  Refresh
                </Button>
              </div>

              <div className="space-y-4">
                {publicGames.map((game) => (
                  <Card key={game.id} className="border-primary/20">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-xl">{game.name}</CardTitle>
                          <CardDescription>
                            Hosted by {game.host}
                          </CardDescription>
                        </div>
                        <Badge variant={game.status === "Starting" ? "secondary" : "default"}>
                          {game.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="text-sm text-muted-foreground">
                            Players: <span className="font-semibold text-foreground">{game.players}/{game.maxPlayers}</span>
                          </div>
                          <div className="flex gap-2">
                            {Array.from({ length: Math.min(game.players, 8) }).map((_, i) => (
                              <div key={i} className="h-2 w-2 rounded-full bg-primary" />
                            ))}
                            {game.players > 8 && (
                              <span className="text-xs text-muted-foreground">
                                +{game.players - 8}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant={game.status === "Starting" ? "outline" : "default"}
                          disabled={game.status === "Starting" || game.players >= game.maxPlayers}
                        >
                          {game.players >= game.maxPlayers ? "Full" : "Join Game"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {publicGames.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <p className="text-muted-foreground">
                      No public games available
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Create a new game to get started!
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
