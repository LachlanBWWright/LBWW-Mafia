import Link from "next/link";
import {
  Bell,
  Home,
  LogIn,
  LogOut,
  Mail,
  Settings,
  Shield,
  UserRound,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { getVisibleNavigationItems } from "@mernmafia/shared/navigation";

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
      <div className="mx-auto flex h-12 w-full min-w-0 items-center gap-1 px-2 sm:h-14 sm:gap-2 sm:px-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/" aria-label="Home" title="Home">
            <Home />
          </Link>
        </Button>
        <nav
          aria-label="Main navigation"
          className="flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden"
        >
          {getVisibleNavigationItems(Boolean(user), Boolean(user?.isAdmin))
            .filter((item) =>
              [
                "Roles",
                "History",
                "Community",
                "About",
                "CreateLobby",
              ].includes(item.key),
            )
            .filter((item) => !("requiresAuth" in item) || Boolean(user))
            .map((item) => (
              <Button
                key={item.key}
                variant="ghost"
                size="sm"
                className="shrink-0 px-2 sm:px-3"
                asChild
              >
                <Link href={item.path}>{item.label}</Link>
              </Button>
            ))}
        </nav>
        <div className="flex shrink-0 items-center gap-0.5">
          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="max-w-28 px-2 sm:max-w-36 sm:px-3"
                asChild
              >
                <Link
                  href="/profile"
                  title="Profile"
                  className="overflow-hidden"
                >
                  <UserRound />
                  <span className="sr-only sm:not-sr-only sm:truncate">
                    {user.handle ? `@${user.handle}` : (user.name ?? "Profile")}
                  </span>
                </Link>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link
                  href="/notifications"
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <Bell />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="sm:h-8 sm:w-auto sm:px-3"
                asChild
              >
                <Link href="/messages" aria-label="Messages" title="Messages">
                  <Mail />
                  <span className="hidden sm:inline">Messages</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="sm:h-8 sm:w-auto sm:px-3"
                asChild
              >
                <Link href="/settings" aria-label="Settings" title="Settings">
                  <Settings />
                  <span className="hidden sm:inline">Settings</span>
                </Link>
              </Button>
              {user.isAdmin ? (
                <Button
                  variant="secondary"
                  size="icon"
                  className="sm:h-8 sm:w-auto sm:px-3"
                  asChild
                >
                  <Link href="/admin" aria-label="Admin" title="Admin">
                    <Shield />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                </Button>
              ) : null}
              <form action={signOutAction}>
                <Button
                  variant="outline"
                  size="icon"
                  className="sm:h-8 sm:w-auto sm:px-3"
                  type="submit"
                  title="Sign out"
                >
                  <LogOut />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </form>
            </>
          ) : (
            <Button size="icon" className="sm:h-8 sm:w-auto sm:px-3" asChild>
              <Link href="/signin" aria-label="Sign in" title="Sign in">
                <LogIn />
                <span className="hidden sm:inline">Sign in</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
