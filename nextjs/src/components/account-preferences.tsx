"use client";
import { useEffect, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@mernmafia/shared/trpc/appRouter";
import {
  avatarPresets,
  avatarOptions,
  type FeaturePreferences,
} from "@mernmafia/shared/trpc/accountFeatures";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
const avatarEmoji: Record<string, string> = Object.fromEntries(
  avatarOptions.map((option) => [option.id, option.symbol]),
);
export function AccountPreferences({
  initialPreferences,
  initialBlocked = [],
  onDeleted,
}: {
  initialPreferences?: FeaturePreferences;
  initialBlocked?: { id: string; name: string | null; handle: string | null }[];
  onDeleted: () => void;
}) {
  const [client] = useState(() =>
    createTRPCProxyClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
    }),
  );
  const [preferences, setPreferences] = useState(initialPreferences);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    if (initialPreferences) return;
    let active = true;
    void Promise.all([
      client.features.preferences.query(),
      client.features.blocked.query(),
    ])
      .then(([p, b]) => {
        if (active) {
          setPreferences(p);
          setBlocked(b);
        }
      })
      .catch(() => {
        if (active) setStatus("Unable to load account preferences.");
      });
    return () => {
      active = false;
    };
  }, [client, initialPreferences]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to complete this action.",
      );
    } finally {
      setBusy(false);
    }
  }
  function update<K extends keyof FeaturePreferences>(
    key: K,
    value: FeaturePreferences[K],
  ) {
    setPreferences((p) => (p ? { ...p, [key]: value } : p));
  }
  if (!preferences)
    return <p role="status">{status || "Loading privacy preferences…"}</p>;
  return (
    <section
      className="space-y-6 border-t pt-5"
      aria-label="Privacy and account data"
    >
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Avatar</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={preferences.avatarPreset === null ? "default" : "outline"}
            disabled={busy}
            onClick={() => update("avatarPreset", null)}
          >
            Google photo
          </Button>
          {avatarPresets.map((id) => (
            <Button
              key={id}
              variant={preferences.avatarPreset === id ? "default" : "outline"}
              aria-pressed={preferences.avatarPreset === id}
              disabled={busy}
              onClick={() => update("avatarPreset", id)}
            >
              <span aria-hidden>{avatarEmoji[id]}</span>{" "}
              {id[0]!.toUpperCase() + id.slice(1)}
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Privacy</h2>
        {(["messagePermission", "invitePermission"] as const).map((key) => (
          <div key={key} className="grid max-w-md gap-2">
            <Label htmlFor={key}>
              {key === "messagePermission"
                ? "Who can message you"
                : "Who can invite you"}
            </Label>
            <select
              id={key}
              value={preferences[key]}
              disabled={busy}
              className="border-input bg-background h-9 rounded-md border px-3"
              onChange={(event) =>
                update(key, event.target.value as "friends" | "nobody")
              }
            >
              <option value="friends">Friends</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>
        ))}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preferences.hidePresence}
            disabled={busy}
            onChange={(e) => update("hidePresence", e.target.checked)}
          />
          Hide online status
        </label>
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">In-app notifications</h2>
        {(
          [
            ["notificationFriendRequests", "Friend requests"],
            ["notificationMessages", "Messages"],
            ["notificationInvites", "Lobby invitations"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preferences[key]}
              disabled={busy}
              onChange={(e) => update(key, e.target.checked)}
            />
            {label}
          </label>
        ))}
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              setPreferences(
                await client.features.updatePreferences.mutate(preferences),
              );
              setStatus("Preferences saved.");
            })
          }
        >
          Save privacy preferences
        </Button>
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Blocked accounts</h2>
        {blocked.length ? (
          <ul className="divide-y">
            {blocked.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span>{user.handle ?? user.name ?? "Player"}</span>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await client.features.unblock.mutate({ userId: user.id });
                      setBlocked((rows) =>
                        rows.filter((row) => row.id !== user.id),
                      );
                    })
                  }
                >
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No blocked accounts.</p>
        )}
      </div>
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Account data</h2>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const data = await client.features.exportData.query();
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                }),
              );
              const link = document.createElement("a");
              link.href = url;
              link.download = "mafia-account.json";
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            })
          }
        >
          Download account data
        </Button>
        <p className="text-muted-foreground text-sm">
          Deleting your account removes your profile and private messages.
          Shared match records remain with your identity removed.
        </p>
        <Label htmlFor="delete-confirmation">
          Type DELETE to delete your account
        </Label>
        <Input
          id="delete-confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="off"
          disabled={busy}
        />
        <Button
          variant="destructive"
          disabled={busy || confirmation !== "DELETE"}
          onClick={() =>
            void run(async () => {
              await client.features.deleteAccount.mutate({
                confirmation: "DELETE",
              });
              onDeleted();
            })
          }
        >
          Delete account
        </Button>
      </div>
      {status ? (
        <p role="status" className="text-sm">
          {status}
        </p>
      ) : null}
    </section>
  );
}
