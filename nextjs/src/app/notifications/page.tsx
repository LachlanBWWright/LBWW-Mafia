import { redirect } from "next/navigation";
import { Header } from "~/components/header";
import { Notifications } from "~/components/notifications";
import { auth } from "~/server/auth";
export default async function NotificationsPage() {
  if (!(await auth())?.user) redirect("/signin");
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Notifications />
      </main>
    </div>
  );
}
