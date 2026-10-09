import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signIn } from "~/server/auth";
import {
  bindMobileBrowser,
  completeMobileGoogle,
  mobileRedirect,
} from "~/server/auth/mobileGoogle";
import { Button } from "~/components/ui/button";
export default async function MobileGooglePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state))
    return (
      <main className="p-8">
        Sign-in expired. Return to the app and try again.
      </main>
    );
  const session = await auth();
  const displayedUserId = session?.user.id;
  async function begin() {
    "use server";
    const secret = randomBytes(32).toString("base64url");
    if (!(await bindMobileBrowser(state!, secret)))
      redirect("/mobile-google?error=expired");
    (await cookies()).set(`mobile-google-${state}`, secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/mobile-google",
    });
    await signIn(
      "google",
      { redirectTo: `/mobile-google?state=${state}` },
      { prompt: "select_account" },
    );
  }
  async function confirm() {
    "use server";
    const current = await auth();
    if (current?.user.id !== displayedUserId)
      redirect(`/mobile-google?state=${state}`);
    const jar = await cookies();
    const secret = jar.get(`mobile-google-${state}`)?.value;
    if (!current?.user.id || !secret) redirect("/mobile-google?error=expired");
    const code = await completeMobileGoogle(state!, secret, current.user.id);
    jar.set(`mobile-google-${state}`, "", {
      path: "/mobile-google",
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    if (!code) redirect("/mobile-google?error=expired");
    redirect(`${mobileRedirect}?state=${state}&code=${code}`);
  }
  const hasBinding = !!(await cookies()).get(`mobile-google-${state}`)?.value;
  return (
    <main className="mx-auto max-w-md space-y-5 px-4 py-12">
      <h1 className="text-2xl font-semibold">Sign in to Mafia</h1>
      {session?.user.id && hasBinding ? (
        <>
          <p>Continue as {session.user.name ?? session.user.email}?</p>
          <form action={confirm}>
            <Button type="submit">Continue to mobile app</Button>
          </form>
        </>
      ) : (
        <form action={begin}>
          <Button type="submit">Continue with Google</Button>
        </form>
      )}
    </main>
  );
}
