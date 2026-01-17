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
            <Link
              href="/lobby"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Lobby
            </Link>
            <Link
              href="/how-to-play"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              How to Play
            </Link>
            <Link
              href="/roles"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Roles
            </Link>
            <Link
              href="/about"
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              About
            </Link>
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
