import { HeaderView } from "~/components/header-view";
import { auth, signOut } from "~/server/auth";

export async function Header() {
  const session = await auth();
  return (
    <HeaderView
      user={session?.user}
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    />
  );
}
