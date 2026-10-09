"use client";

import { LobbyPresets } from "~/components/lobby-presets";
import { lobbyPresetForm } from "@mernmafia/shared/game/lobbyPresetForm";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import {
  lobbyRoles as roles,
  selectionAlgorithms,
  initialRoleForms,
  parseLobbyForm,
  type RoleForm,
} from "@mernmafia/shared/game/lobbyConfig";

export default function CreateLobbyPage() {
  const router = useRouter();
  const [size, setSize] = useState("8");
  const [algorithm, setAlgorithm] = useState("weighted-random");
  const [roleStates, setRoleStates] = useState(initialRoleForms);
  const [explicitSlots, setExplicitSlots] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCount = useMemo(
    () => Object.values(roleStates).filter((role) => role.enabled).length,
    [roleStates],
  );

  function updateRole(id: string, patch: Partial<RoleForm>) {
    setRoleStates((current) => {
      const existing = current[id];
      return existing
        ? { ...current, [id]: { ...existing, ...patch } }
        : current;
    });
  }

  async function createLobby() {
    setSubmitting(true);
    setError(null);
    const parsed = parseLobbyForm(size, algorithm, roleStates, explicitSlots);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid lobby rules.");
      setSubmitting(false);
      return;
    }
    const body = parsed.data;
    try {
      const response = await fetch("/api/lobbies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        roomId?: string;
        error?: string;
      };
      if (!response.ok || !result.roomId)
        throw new Error(result.error ?? "Unable to create lobby.");
      router.push(`/lobby?room=${encodeURIComponent(result.roomId)}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to create lobby.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold">Create custom lobby</h1>
        <p className="text-muted-foreground text-sm">
          Tune role selection before inviting players.
        </p>
      </div>
      <LobbyPresets
        getConfig={() => {
          const parsed = parseLobbyForm(
            size,
            algorithm,
            roleStates,
            explicitSlots,
          );
          if (!parsed.success)
            throw new Error(
              parsed.error.issues[0]?.message ?? "Invalid lobby rules.",
            );
          return parsed.data;
        }}
        onApply={(config) => {
          const form = lobbyPresetForm(config);
          setSize(form.size);
          setAlgorithm(form.algorithm);
          setRoleStates(form.roles);
          setExplicitSlots(form.slots);
          setError(null);
        }}
      />
      <div className="mt-5 grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Lobby rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="player-count">Players</Label>
              <Input
                id="player-count"
                type="number"
                min="2"
                max="64"
                value={size}
                onChange={(event) => setSize(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Selection algorithm</Label>
              <div className="grid gap-2">
                {selectionAlgorithms.map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={algorithm === value ? "default" : "outline"}
                    className="justify-start"
                    onClick={() => setAlgorithm(value ?? "")}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {algorithm === "explicit-slots" ? (
              <div className="space-y-2">
                <Label htmlFor="explicit-slots">Role slots</Label>
                <Input
                  id="explicit-slots"
                  placeholder="doctor, mafia, investigator"
                  value={explicitSlots}
                  onChange={(event) => setExplicitSlots(event.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Use role IDs separated by commas; the count must equal the
                  player count.
                </p>
              </div>
            ) : null}
            {algorithm !== "explicit-slots" ? (
              <p className="text-muted-foreground text-xs">
                {selectedCount} roles enabled
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-foreground text-sm">
                {error}
              </p>
            ) : null}
            <Button
              className="w-full"
              onClick={createLobby}
              disabled={submitting}
            >
              {submitting ? "Creating…" : "Create lobby"}
            </Button>
          </CardContent>
        </Card>
        {algorithm !== "explicit-slots" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role pool</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-muted-foreground hidden grid-cols-[1fr_80px_80px_80px_80px] gap-2 px-2 text-xs sm:grid">
                <span>Role</span>
                <span>Weight</span>
                <span>Min</span>
                <span>Max</span>
                <span>Tier</span>
              </div>
              {roles.map(([id, label]) => {
                const role = roleStates[id]!;
                return (
                  <div
                    key={id}
                    className="grid grid-cols-2 items-center gap-2 rounded-md border p-2 sm:grid-cols-[1fr_80px_80px_80px_80px]"
                  >
                    <label className="flex min-w-0 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={role.enabled}
                        onChange={(event) =>
                          updateRole(id, { enabled: event.target.checked })
                        }
                      />
                      <span className="truncate">{label}</span>
                    </label>
                    {(["weight", "minimum", "maximum", "tier"] as const).map(
                      (field) => (
                        <Input
                          key={field}
                          disabled={!role.enabled}
                          aria-label={`${label} ${field}`}
                          className="h-8"
                          type="number"
                          min="0"
                          placeholder={
                            field === "maximum" || field === "tier" ? "—" : "0"
                          }
                          value={role[field]}
                          onChange={(event) =>
                            updateRole(id, {
                              [field]: event.target.value,
                            })
                          }
                        />
                      ),
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
