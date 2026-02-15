"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "~/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center px-4">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-4 flex items-center space-x-2 pl-2">
            <span className="font-bold text-xl">
              MERN <span className="text-primary">Mafia</span>
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/lobby">Lobby</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/roles">Roles</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/about">About</Link>
            </Button>
          </nav>
        </div>
        <div className="ml-auto flex items-center gap-2 pr-2">
          <Button variant="ghost" size="sm" onClick={() => signIn("google")}>
            Sign In with Google
          </Button>
          <Button size="sm" asChild>
            <Link href="/lobby">Join Game</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
