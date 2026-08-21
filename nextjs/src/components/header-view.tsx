import Link from "next/link";

import { Button } from "~/components/ui/button";

export type HeaderUser = {
  name?: string | null;
  handle?: string | null;
  isAdmin?: boolean;
};

export function HeaderView({
  user,
  signOutAction,
}: {
  user?: HeaderUser;
  signOutAction?: () => Promise<void>;
}) {
  return (
    <header className="border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="flex h-14 w-full items-center px-5">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-4 flex items-center space-x-2 pl-3">
            <span className="text-xl font-bold">
              LBWW <span className="text-primary">Mafia</span>
            </span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-2 text-sm"
          >
            <Button variant="ghost" size="sm" asChild>
              <Link href="/roles">Roles</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/history">History</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/community">Community</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/about">About</Link>
            </Button>
          </nav>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/profile">
                  {user.handle ? `@${user.handle}` : (user.name ?? "Profile")}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings">Settings</Link>
              </Button>
              {user.isAdmin ? (
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/admin">Admin</Link>
                </Button>
              ) : null}
              <form action={signOutAction}>
                <Button variant="outline" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link href="/signin">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
