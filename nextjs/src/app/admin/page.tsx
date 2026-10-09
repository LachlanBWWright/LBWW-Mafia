import { PlayerReports } from "~/components/player-reports";
import { Header } from "~/components/header";
import { AdminUserSearch } from "~/components/admin-user-search";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { auth } from "~/server/auth";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const params = (await searchParams) ?? {};

  if (!session?.user?.isAdmin) {
    return (
      <div className="bg-background min-h-screen">
        <Header />
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Admin</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                You are not authorized.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Admin User Search</CardTitle>
          </CardHeader>
          <CardContent>
            <AdminUserSearch initialQuery={params.q ?? ""} />
          </CardContent>
        </Card>
        <PlayerReports moderation />
      </main>
    </div>
  );
}
