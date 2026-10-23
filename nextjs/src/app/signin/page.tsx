import Link from "next/link";
import { signIn } from "~/server/auth";
import { isGoogleSignInConfigured } from "~/server/auth/googleConfiguration";
import { Button } from "~/components/ui/button";
import { Home } from "lucide-react";
export const dynamic = "force-dynamic";

export default function SignInPage() {
  const available = isGoogleSignInConfigured();
  async function begin() {
    "use server";
    if (!isGoogleSignInConfigured()) return;
    await signIn("google", { redirectTo: "/profile" });
  }
  return (
    <div className="bg-background min-h-screen">
      <header className="border-b px-2 py-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/" aria-label="Home">
            <Home />
          </Link>
        </Button>
      </header>
      <main className="mx-auto max-w-md space-y-5 px-4 py-10">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        {!available && (
          <p role="status">Google sign-in is unavailable right now.</p>
        )}
        <form action={begin}>
          <Button className="w-full" type="submit" disabled={!available}>
            Continue with Google
          </Button>
        </form>
      </main>
    </div>
  );
}
