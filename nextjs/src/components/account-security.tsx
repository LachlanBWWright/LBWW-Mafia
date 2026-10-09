"use client";
import { useEffect, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@mernmafia/shared/trpc/appRouter";
import { Button } from "./ui/button";
type Device = { id: string; deviceName: string; createdAt: Date };
export function AccountSecurity({
  initialSessions,
}: {
  initialSessions?: Device[];
}) {
  const [client] = useState(() =>
    createTRPCProxyClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
    }),
  );
  const [sessions, setSessions] = useState<Device[]>(initialSessions ?? []);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initialSessions) return;
    void client.account.deviceSessions
      .query()
      .then(setSessions)
      .catch(() => setMessage("Unable to load device sessions."));
  }, [client, initialSessions]);
  async function revoke(id: string) {
    setBusy(true);
    try {
      await client.account.revokeDeviceSession.mutate({ sessionId: id });
      setSessions((current) => current.filter((session) => session.id !== id));
    } catch {
      setMessage("Unable to sign out device. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 border-t pt-5" aria-label="Account security">
      <h2 className="text-lg font-semibold">Account security</h2>
      <p className="text-muted-foreground text-sm">
        Sign-in is managed by your Google account.
      </p>
      <a
        href="https://myaccount.google.com/security"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm underline"
      >
        Manage Google security
      </a>
      <h3 className="font-medium">Mobile devices</h3>
      {sessions.length ? (
        <ul className="divide-y">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <span>{session.deviceName}</span>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void revoke(session.id)}
                aria-label={`Sign out ${session.deviceName}`}
              >
                Sign out device
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No active mobile sessions.
        </p>
      )}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </section>
  );
}
