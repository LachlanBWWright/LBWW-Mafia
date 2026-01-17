import { Header } from "~/components/header";
import { Footer } from "~/components/footer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function RolesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <div className="container mx-auto flex-1 px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Game <span className="text-primary">Roles</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Discover the unique abilities and win conditions of each role
            </p>
          </div>

          {/* Town Roles */}
          <div className="mb-12">
            <h2 className="mb-6 text-3xl font-bold">
              <span className="text-primary">Town</span> Roles
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle>Investigator</CardTitle>
                  <CardDescription>Town Investigative</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Ability:</span> Check one player each night to learn their faction
                  </p>
                  <p>
                    Use your investigation skills to identify Mafia members and help the Town make informed decisions.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle>Doctor</CardTitle>
                  <CardDescription>Town Protective</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Ability:</span> Protect one player from death each night
                  </p>
                  <p>
                    Save lives by protecting players from Mafia attacks. Choose wisely who to guard each night.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle>Watchman</CardTitle>
                  <CardDescription>Town Investigative</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Ability:</span> See who visits your target at night
                  </p>
                  <p>
                    Track player movements to identify suspicious behavior and catch Mafia members in the act.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle>Jailor</CardTitle>
                  <CardDescription>Town Killing</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Ability:</span> Jail and interrogate players, can execute
                  </p>
                  <p>
                    A powerful role that can roleblock and eliminate suspects. Use your executions carefully.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle>Tracker</CardTitle>
                  <CardDescription>Town Investigative</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Ability:</span> See who your target visits at night
                  </p>
                  <p>
                    Follow players to discover their night actions and uncover hidden information.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle>Bodyguard</CardTitle>
                  <CardDescription>Town Protective</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Ability:</span> Protect a player and kill their attacker
                  </p>
                  <p>
                    Sacrifice yourself to save important Town members and eliminate Mafia attackers.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Mafia Roles */}
          <div className="mb-12">
            <h2 className="mb-6 text-3xl font-bold">
              <span className="text-destructive">Mafia</span> Roles
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-destructive/20">
                <CardHeader>
                  <CardTitle>Godfather</CardTitle>
                  <CardDescription>Mafia Leader</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Ability:</span> Appears innocent to investigations
                  </p>
                  <p>
                    Lead the Mafia to victory while avoiding detection by investigators.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-destructive/20">
                <CardHeader>
                  <CardTitle>Consigliere</CardTitle>
                  <CardDescription>Mafia Support</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Ability:</span> Learn the exact role of a player
                  </p>
                  <p>
                    Gather intelligence on Town roles to help the Mafia make strategic decisions.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-destructive/20">
                <CardHeader>
                  <CardTitle>Silencer</CardTitle>
                  <CardDescription>Mafia Support</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Ability:</span> Prevent a player from talking during the day
                  </p>
                  <p>
                    Silence key Town members to prevent them from sharing important information.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Neutral Roles */}
          <div>
            <h2 className="mb-6 text-3xl font-bold">
              <span className="text-muted-foreground">Neutral</span> Roles
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-muted-foreground/20">
                <CardHeader>
                  <CardTitle>Jester</CardTitle>
                  <CardDescription>Neutral Evil</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Win Condition:</span> Get yourself voted out
                  </p>
                  <p>
                    Act suspicious and manipulate the Town into eliminating you during the day.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-muted-foreground/20">
                <CardHeader>
                  <CardTitle>Survivor</CardTitle>
                  <CardDescription>Neutral Benign</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Win Condition:</span> Stay alive until the end
                  </p>
                  <p>
                    Use your vests to survive attacks and outlast all other players.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-muted-foreground/20">
                <CardHeader>
                  <CardTitle>Serial Killer</CardTitle>
                  <CardDescription>Neutral Killing</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="mb-2">
                    <span className="font-semibold text-foreground">Win Condition:</span> Be the last one standing
                  </p>
                  <p>
                    Kill everyone in your path to achieve solo victory.
                  </p>
                </CardContent>
              </Card>
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
