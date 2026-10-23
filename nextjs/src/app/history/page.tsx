import Link from "next/link";
import { buttonVariants } from "~/components/ui/button";
import { Header } from "~/components/header";
import { RecentMatches } from "~/components/recent-matches";
import { auth } from "~/server/auth";

export default async function HistoryPage() {
  const session = await auth();

  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        {session?.user ? (
          <RecentMatches currentUser title="Recent Matches" />
        ) : (
          <section className="space-y-4">
            <h1 className="text-2xl font-semibold">Recent Matches</h1>
            <p className="text-muted-foreground">
              Sign in with Google to see your account’s match history.
            </p>
            <Link href="/signin" className={buttonVariants()}>
              Sign in
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
