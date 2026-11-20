import Link from "next/link";
import { Button } from "./ui/button";

export function LandingContent() {
  return (
    <div className="w-full py-6 sm:py-12">
      <section className="space-y-7">
        <h1 className="max-w-lg text-5xl leading-[0.95] font-black tracking-[-0.055em] text-balance sm:text-7xl">
          LBWW Mafia
        </h1>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/lobby">Quick Join</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/lobby/create">Create Lobby</Link>
          </Button>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link
            className="decoration-border hover:decoration-primary focus-visible:outline-ring inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2"
            href="/lobbies"
          >
            Public Lobbies
          </Link>
        </div>
      </section>
    </div>
  );
}
