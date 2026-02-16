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
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Admin</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">You are not authorized.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
      </main>
    </div>
  );
}
