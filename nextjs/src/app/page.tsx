import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Header } from "~/components/header";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="container mx-auto flex flex-1 items-center justify-center px-4 py-16">
        <div className="space-y-6 text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            MERN <span className="text-primary">Mafia</span>
          </h1>
          <p className="mx-auto max-w-[700px] text-lg text-muted-foreground sm:text-xl">
            Join a live game and start playing.
          </p>
          <Button size="lg" className="text-base" asChild>
            <Link href="/lobby">Join Game</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
