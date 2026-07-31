"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export default function SignInPage() {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true); setError("");
    const emailValue = formData.get("email"); const passwordValue = formData.get("password");
    const email = typeof emailValue === "string" ? emailValue : "";
    const password = typeof passwordValue === "string" ? passwordValue : "";
    if (mode === "register") {
      const response = await fetch("/api/account/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name: formData.get("name"), handle: formData.get("handle") }) });
      if (!response.ok) { const body = await response.json() as { error?: string }; setError(body.error ?? "Registration failed."); setBusy(false); return; }
    }
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) { setError("Email or password is incorrect."); setBusy(false); return; }
    window.location.href = "/profile";
  }
  return <div className="min-h-screen bg-background"><header className="border-b p-4 text-xl font-bold"><Link href="/">LBWW Mafia</Link></header><main className="mx-auto max-w-md px-4 py-10">
    <Card><CardHeader><CardTitle>{mode === "signin" ? "Sign in" : "Create account"}</CardTitle></CardHeader><CardContent className="space-y-4">
      <Button className="w-full" variant="outline" onClick={() => signIn("google", { callbackUrl: "/profile" })}>Continue with Google</Button>
      <div className="text-center text-xs text-muted-foreground">or use your LBWW Mafia account</div>
      <form action={submit} className="space-y-3">
        {mode === "register" ? <><div><Label htmlFor="name">Display name</Label><Input id="name" name="name" required minLength={2} /></div><div><Label htmlFor="handle">Handle</Label><Input id="handle" name="handle" required minLength={3} pattern="[a-zA-Z0-9_]+" /></div></> : null}
        <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required minLength={10} /></div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</Button>
      </form>
      <button className="w-full text-sm text-muted-foreground underline" onClick={() => { setMode(mode === "signin" ? "register" : "signin"); setError(""); }}>{mode === "signin" ? "Create a first-party account" : "Already have an account? Sign in"}</button>
      <p className="text-center text-xs text-muted-foreground"><Link href="/" className="underline">Return home</Link></p>
    </CardContent></Card>
  </main></div>;
}
