import { Header } from "~/components/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export default function HowToPlayPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              How to Play <span className="text-primary">Mafia</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Learn the basics of this thrilling social deduction game
            </p>
          </div>

          {/* Game Overview */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">Game Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Mafia is a social deduction game where players are divided into two main factions:
                the <span className="font-semibold text-foreground">Town</span> (innocent citizens) 
                and the <span className="font-semibold text-destructive">Mafia</span> (criminals).
              </p>
              <p className="text-muted-foreground">
                The Town's goal is to identify and eliminate all Mafia members through voting.
                The Mafia's goal is to eliminate enough Town members to equal or outnumber them.
              </p>
            </CardContent>
          </Card>

          {/* Day Phase */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">Day Phase</CardTitle>
              <CardDescription>
                Discussion and voting take place during the day
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold">Discussion</h3>
                <p className="text-sm text-muted-foreground">
                  Players discuss suspicions, share information from night actions,
                  and try to identify Mafia members. Use logic and observation
                  to find inconsistencies in others' claims.
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Voting</h3>
                <p className="text-sm text-muted-foreground">
                  At the end of the day, players vote to eliminate someone they
                  suspect is Mafia. The player with the most votes is eliminated
                  from the game.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Night Phase */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">Night Phase</CardTitle>
              <CardDescription>
                Special abilities are used during the night
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold">Mafia Actions</h3>
                <p className="text-sm text-muted-foreground">
                  The Mafia secretly chooses a Town member to eliminate. They
                  communicate privately to coordinate their strategy.
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold">Special Roles</h3>
                <p className="text-sm text-muted-foreground">
                  Various Town roles can perform special actions at night, such
                  as investigating players, protecting targets, or blocking actions.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Win Conditions */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-2xl">Win Conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="mb-2 font-semibold text-primary">Town Victory</h3>
                <p className="text-sm text-muted-foreground">
                  The Town wins when all Mafia members have been eliminated.
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-destructive">Mafia Victory</h3>
                <p className="text-sm text-muted-foreground">
                  The Mafia wins when they equal or outnumber the remaining
                  Town members.
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-muted-foreground">Neutral Roles</h3>
                <p className="text-sm text-muted-foreground">
                  Some roles have unique win conditions independent of Town or
                  Mafia, adding complexity to the game.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Pro Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Pay attention to voting patterns and player behavior</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Keep track of role claims and verify them when possible</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Don't reveal your role too early unless necessary</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Use night actions strategically to gather information</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Communication and deduction are key to winning</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
