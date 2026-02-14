import Link from "next/link";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Header } from "~/components/header";
import { Footer } from "~/components/footer";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      {/* Hero Section */}
      <div className="container mx-auto flex-1 px-4 py-16">
        <div className="flex flex-col items-center justify-center space-y-8 text-center">
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
              MERN <span className="text-primary">Mafia</span>
            </h1>
            <p className="mx-auto max-w-[700px] text-lg text-muted-foreground sm:text-xl">
              The ultimate online multiplayer social deduction game. Gather your
              friends and uncover the truth.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" className="text-base" asChild>
              <Link href="/lobby">Play Now</Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base" asChild>
              <Link href="/how-to-play">Learn More</Link>
            </Button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="mt-24 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-primary/20 transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-xl">Real-Time Gameplay</CardTitle>
              <CardDescription>
                Play with friends in real-time using WebSocket technology for
                instant updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Experience seamless multiplayer action with no lag or delays
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-xl">Multiple Roles</CardTitle>
              <CardDescription>
                Choose from a variety of roles including Mafia, Town, and
                Neutral alignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Each role has unique abilities and win conditions
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 transition-colors hover:border-primary/50">
            <CardHeader>
              <CardTitle className="text-xl">Private Rooms</CardTitle>
              <CardDescription>
                Create private game rooms and invite your friends to play
                together
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Customize game settings and room size to your preference
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How to Play Section */}
        <div className="mt-24">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How to Play
            </h2>
            <p className="mt-2 text-muted-foreground">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                1
              </div>
              <h3 className="mb-2 text-xl font-semibold">Join a Game</h3>
              <p className="text-muted-foreground">
                Enter your username and join a public game or create a private
                room
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                2
              </div>
              <h3 className="mb-2 text-xl font-semibold">Get Your Role</h3>
              <p className="text-muted-foreground">
                Receive your secret role and learn about your abilities and
                objectives
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                3
              </div>
              <h3 className="mb-2 text-xl font-semibold">Play & Win</h3>
              <p className="text-muted-foreground">
                Use strategy and deduction to achieve your faction&#39;s victory
                condition
              </p>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-24 rounded-xl border border-primary/20 bg-card p-8 text-center">
          <h2 className="mb-4 text-2xl font-bold sm:text-3xl">
            Ready to Play?
          </h2>
          <p className="mb-6 text-muted-foreground">
            Join thousands of players in the ultimate game of deception and
            deduction
          </p>
          <Button size="lg" className="text-base" asChild>
            <Link href="/lobby">Start Playing Now</Link>
          </Button>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
