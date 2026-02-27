import Link from "next/link";
import { Header } from "~/components/header";
import { RecentMatches } from "~/components/recent-matches";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { auth } from "~/server/auth";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sign in to view your profile and match history.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{session.user.name ?? "Player profile"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">{session.user.email}</p>
            {session.user.isAdmin ? (
              <Button asChild size="sm" variant="secondary">
                <Link href="/admin">Open Admin Page</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
        <RecentMatches username={session.user.name ?? ""} title="Your Recent Matches" />
      </main>
    </div>
  );
}
