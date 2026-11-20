"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "~/components/ui/button";
import { getNavigationGroups } from "@mernmafia/shared/navigation";

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
  const pathname = usePathname();
  const menu = useRef<HTMLDetailsElement>(null);
  const { primary, secondary } = getNavigationGroups(
    Boolean(user),
    Boolean(user?.isAdmin),
  );
  const selected = (path: string) => pathname === path;
  return (
    <header className="bg-background/95 border-border sticky top-0 z-50 border-b backdrop-blur">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex min-h-14 max-w-7xl items-center gap-1 px-2 sm:gap-3 sm:px-6"
      >
        {primary.map((item) => (
          <Button
            key={item.key}
            variant={selected(item.path) ? "secondary" : "ghost"}
            className="px-2 sm:px-3"
            asChild
          >
            <Link
              href={item.path}
              aria-current={selected(item.path) ? "page" : undefined}
            >
              {item.key === "Home" ? "Play" : item.label}
            </Link>
          </Button>
        ))}
        <details
          ref={menu}
          className="group relative ms-auto"
          onKeyDown={(event) => {
            if (event.key === "Escape" && menu.current) {
              menu.current.open = false;
              menu.current.querySelector("summary")?.focus();
            }
          }}
        >
          <summary className="hover:bg-accent focus-visible:ring-ring flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md px-3 text-sm font-medium focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
            Menu{" "}
            <ChevronDown aria-hidden className="size-4 group-open:rotate-180" />
          </summary>
          <div className="bg-popover border-border absolute end-0 top-full mt-2 grid max-h-[70dvh] w-60 gap-1 overflow-y-auto rounded-lg border p-2 shadow-lg">
            {secondary.map((item) => (
              <Link
                key={item.key}
                href={item.path}
                aria-current={selected(item.path) ? "page" : undefined}
                onClick={() => {
                  if (menu.current) menu.current.open = false;
                }}
                className={
                  "hover:bg-accent focus-visible:ring-ring flex min-h-11 items-center rounded-md px-3 text-sm focus-visible:ring-2 " +
                  (selected(item.path) ? "bg-secondary font-semibold" : "")
                }
              >
                {item.key === "Profile" && user?.handle
                  ? "@" + user.handle
                  : item.label}
              </Link>
            ))}
            {user ? (
              <form
                action={signOutAction}
                className="border-border border-t pt-1"
              >
                <Button
                  variant="ghost"
                  type="submit"
                  className="w-full justify-start"
                >
                  Sign out
                </Button>
              </form>
            ) : null}
          </div>
        </details>
        {!user ? (
          <Button asChild className="px-3">
            <Link href="/signin">Sign in</Link>
          </Button>
        ) : null}
      </nav>
    </header>
  );
}
