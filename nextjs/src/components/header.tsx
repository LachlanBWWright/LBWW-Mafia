import Link from "next/link";
import { Button } from "~/components/ui/button";
import { auth, signOut } from "~/server/auth";

export async function Header() {
  const session = await auth();
  return (
    <header className="border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur">
      <div className="flex h-14 w-full items-center px-5">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-4 flex items-center space-x-2 pl-3">
            <span className="text-xl font-bold">LBWW <span className="text-primary">Mafia</span></span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" asChild><Link href="/roles">Roles</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/history">History</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/community">Community</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/about">About</Link></Button>
          </nav>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {session?.user ? (
            <>
              <Button variant="ghost" size="sm" asChild><Link href="/profile">{session.user.handle ? `@${session.user.handle}` : session.user.name ?? "Profile"}</Link></Button>
              <Button variant="ghost" size="sm" asChild><Link href="/settings">Settings</Link></Button>
              {session.user.isAdmin ? <Button variant="secondary" size="sm" asChild><Link href="/admin">Admin</Link></Button> : null}
              <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                <Button variant="outline" size="sm" type="submit">Sign out</Button>
              </form>
            </>
          ) : <Button size="sm" asChild><Link href="/signin">Sign in</Link></Button>}
        </div>
      </div>
    </header>
  );
}
