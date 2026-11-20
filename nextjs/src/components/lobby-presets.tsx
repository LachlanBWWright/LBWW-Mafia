"use client";
import { useEffect, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { isUnauthorizedPresetError } from "./game-customization/form-helpers";
import superjson from "superjson";
import type { AppRouter } from "@mernmafia/shared/trpc/appRouter";
import type { LobbyPreset } from "@mernmafia/shared/trpc/accountFeatures";
import type { LobbyConfig } from "@mernmafia/shared/game/lobbyConfig";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
export function LobbyPresets({
  getConfig,
  onApply,
  initialPresets,
}: {
  getConfig: () => LobbyConfig;
  onApply: (config: LobbyConfig) => void;
  initialPresets?: LobbyPreset[];
}) {
  const [client] = useState(() =>
    createTRPCProxyClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
    }),
  );
  const [presets, setPresets] = useState(initialPresets ?? []),
    [name, setName] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);
  useEffect(() => {
    if (initialPresets) return;
    let active = true;
    void client.features.presets
      .query()
      .then((p) => {
        if (active) setPresets(p);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isUnauthorizedPresetError(error)) {
          setSignInRequired(true);
        } else setStatus("Unable to load saved presets.");
      });
    return () => {
      active = false;
    };
  }, [client, initialPresets]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unable to save preset.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-3 border-b pb-5"
      aria-label="Saved lobby presets"
    >
      <h2 className="font-semibold">Saved presets</h2>
      {signInRequired ? (
        <p className="text-sm">
          <a
            className="underline underline-offset-4"
            href="/signin?callbackUrl=%2Flobby%2Fcreate"
          >
            Sign in to save and load presets
          </a>
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-2">
          <Label htmlFor="preset-name">Preset name</Label>
          <Input
            id="preset-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>
        <Button
          variant="outline"
          disabled={busy || signInRequired || !name.trim()}
          onClick={() =>
            void run(async () => {
              const preset = await client.features.savePreset.mutate({
                name: name.trim(),
                config: getConfig(),
              });
              setPresets((p) => [...p, preset]);
              setName("");
              setStatus("Preset saved.");
            })
          }
        >
          Save current rules
        </Button>
      </div>
      {presets.length ? (
        <ul className="divide-y">
          {presets.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                {p.name} · {p.config.size} players
              </span>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  onApply(p.config);
                  setStatus(`${p.name} loaded.`);
                }}
              >
                Load
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                aria-label={`Delete ${p.name}`}
                onClick={() =>
                  void run(async () => {
                    await client.features.deletePreset.mutate({ id: p.id });
                    setPresets((rows) => rows.filter((row) => row.id !== p.id));
                  })
                }
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No saved presets.</p>
      )}
      {status ? (
        <p role="status" className="text-sm">
          {status}
        </p>
      ) : null}
    </section>
  );
}
