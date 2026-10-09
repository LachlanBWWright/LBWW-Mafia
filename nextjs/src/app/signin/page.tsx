"use client";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "~/components/ui/button";
import { Home } from "lucide-react";
export default function SignInPage() {
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
        <Button
          className="w-full"
          onClick={() => void signIn("google", { callbackUrl: "/profile" })}
        >
          Continue with Google
        </Button>
      </main>
    </div>
  );
}
