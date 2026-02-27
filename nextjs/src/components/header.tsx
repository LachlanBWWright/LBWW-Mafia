"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "~/components/ui/button";

export function Header() {
  return (
    <header className="border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="flex h-14 w-full items-center px-5">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-4 flex items-center space-x-2 pl-3">
            <span className="text-xl font-bold">
              LBWW <span className="text-primary">Mafia</span>
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/roles">Roles</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/about">About</Link>
            </Button>
          </nav>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => signIn("google")}>
            Sign In with Google
          </Button>
        </div>
      </div>
    </header>
  );
}
