import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Header } from "~/components/header";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-12">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              MERN <span className="text-primary">Mafia</span>
            </h1>
            <p className="max-w-[700px] text-lg text-muted-foreground sm:text-xl">
              Enter a live game instantly, coordinate through chat, and make your
              move before the timer runs out.
            </p>
            <Button size="lg" className="text-base" asChild>
              <Link href="/lobby">Join Game</Link>
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card/70 p-5">
            <h2 className="mb-2 text-lg font-semibold">Quick Start</h2>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Join a public room.</li>
              <li>2. Watch day/night countdowns.</li>
              <li>3. Chat, vote, visit, and whisper from the player panel.</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
