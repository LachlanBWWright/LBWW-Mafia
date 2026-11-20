import Link from "next/link";
import { Header } from "~/components/header";
import { auth } from "~/server/auth";
import { Campaigns } from "~/components/campaigns";

export default async function CampaignsPage() {
  const session = await auth();
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <h1 className="text-3xl font-semibold">Persistent lobbies</h1>
        {session?.user ? (
          <Campaigns />
        ) : (
          <p>
            Sign in to organise a private game night.{" "}
            <Link href="/signin" className="underline">
              Sign in
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
