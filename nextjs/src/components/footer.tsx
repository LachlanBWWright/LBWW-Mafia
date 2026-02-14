import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background/95">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <h3 className="mb-4 text-lg font-semibold">
              MERN <span className="text-primary">Mafia</span>
            </h3>
            <p className="text-sm text-muted-foreground">
              The ultimate online multiplayer social deduction game
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold">Game</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href="/lobby">Play Now</Link>
                </Button>
              </li>
              <li>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href="/how-to-play">How to Play</Link>
                </Button>
              </li>
              <li>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href="/roles">Roles</Link>
                </Button>
              </li>
              <li>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href="/about">About</Link>
                </Button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Button variant="link" className="h-auto p-0" asChild>
                  <a
                    href="https://github.com/LachlanBWWright/MERN-Mafia"
                    className="hover:text-foreground"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub
                  </a>
                </Button>
              </li>
              <li>
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link href="/docs">Documentation</Link>
                </Button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold">Tech Stack</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Next.js & React</li>
              <li>Drizzle ORM</li>
              <li>Tailwind CSS</li>
              <li>shadcn/ui</li>
            </ul>
          </div>
        </div>

        <Separator className="mt-8" />
        <div className="pt-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} MERN Mafia. Built with ❤️ using modern web technologies.</p>
        </div>
      </div>
    </footer>
  );
}
