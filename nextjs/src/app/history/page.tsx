import { Header } from "~/components/header";
import { RecentMatches } from "~/components/recent-matches";
import { auth } from "~/server/auth";

export default async function HistoryPage() {
  const session = await auth();
  const username = session?.user?.name ?? "";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <RecentMatches username={username} title="Recent Matches" />
      </main>
    </div>
  );
}
