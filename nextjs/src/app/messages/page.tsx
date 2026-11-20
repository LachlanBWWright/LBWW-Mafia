import { redirect } from "next/navigation";
import { Header } from "~/components/header";
import { Messages } from "~/components/messages";
import { auth } from "~/server/auth";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: Promise<{ user?: string }>;
}) {
  const params = await searchParams;
  if (!(await auth())?.user) redirect("/signin");
  return (
    <div className="bg-background min-h-screen">
      <Header />
      <Messages initialUserId={params?.user} />
    </div>
  );
}
