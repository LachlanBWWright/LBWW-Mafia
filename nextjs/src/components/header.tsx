import Link from "next/link";
import { Button } from "~/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold text-xl">
              MERN <span className="text-primary">Mafia</span>
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/lobby">Lobby</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/how-to-play">How to Play</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/roles">Roles</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/about">About</Link>
            </Button>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <Button variant="ghost" size="sm">
            Sign In
          </Button>
          <Button size="sm" asChild>
            <Link href="/lobby">Play Now</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
