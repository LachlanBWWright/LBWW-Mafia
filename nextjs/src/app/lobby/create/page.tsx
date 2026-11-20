"use client";

import { syncCustomRoleForms } from "~/components/game-customization/form-helpers";
import { RulesEditor } from "~/components/game-customization/rules-editor";
import { CustomRoleEditor } from "~/components/game-customization/custom-role-editor";
import { GamePackPanel } from "~/components/game-customization/game-pack-panel";
import {
  resolveGameRules,
  summarizeGameSetup,
  getSetupWarnings,
} from "@mernmafia/shared/game/gameCustomization";
import type { CustomRole } from "@mernmafia/shared/game/customRoles";
import {
  lobbyConfigSchema,
  type LobbyConfig,
} from "@mernmafia/shared/game/lobbyConfig";
import { LobbyPresets } from "~/components/lobby-presets";
import { lobbyPresetForm } from "@mernmafia/shared/game/lobbyPresetForm";
import { useState } from "react";
import { MAX_PLAYERS } from "@mernmafia/shared/game/gameNames";
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
  const [voteVisibility, setVoteVisibility] = useState<"public" | "hidden">(
    "public",
  );
  const [size, setSize] = useState("8");
  const [isPublic, setIsPublic] = useState(false);
  const [lobbyName, setLobbyName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [algorithm, setAlgorithm] = useState("normal");
  const [roleStates, setRoleStates] = useState(initialRoleForms);
  const [explicitSlots, setExplicitSlots] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sizeInvalid =
    !Number.isInteger(Number(size)) ||
    Number(size) < 2 ||
    Number(size) > MAX_PLAYERS;

  const [rules, setRules] = useState(() => resolveGameRules({}));
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const selectedCount = Object.values(roleStates).filter(
    (role) => role.enabled,
  ).length;
  const roleOptions = [
    ...roles,
    ...customRoles.map((role) => [`custom:${role.id}`, role.name] as const),
  ];
  const preview = parseLobbyForm(size, algorithm, roleStates, explicitSlots, {
    rules,
    customRoles,
    voteVisibility,
  });

  function getConfig(): LobbyConfig {
    const parsed = parseLobbyForm(size, algorithm, roleStates, explicitSlots, {
      rules,
      customRoles,
      voteVisibility,
    });
    if (!parsed.success)
      throw new Error(
        parsed.error.issues[0]?.message ?? "Invalid lobby rules.",
      );
    return parsed.data;
  }
  function applyConfig(input: LobbyConfig) {
    const config = lobbyConfigSchema.parse(input);
    const form = lobbyPresetForm(config);
    setVoteVisibility(config.voteVisibility ?? "public");
    setRules(resolveGameRules(config));
    setCustomRoles(config.customRoles ?? []);
    setSize(form.size);
    setAlgorithm(form.algorithm);
    setRoleStates(
      syncCustomRoleForms(form.roles, config.customRoles ?? [], false),
    );
    setExplicitSlots(form.slots);
    setError(null);
  }
  function updateCustomRoles(next: CustomRole[]) {
    setCustomRoles(next);
    setRoleStates((current) => syncCustomRoleForms(current, next));
  }

  function updateRole(id: string, patch: Partial<RoleForm>) {
    setRoleStates((current) => {
      const existing = current[id];
      return existing
        ? { ...current, [id]: { ...existing, ...patch } }
        : current;
    });
  }

  async function createLobby() {
    setNameTouched(true);
    setSubmitting(true);
    setError(null);
    const parsed = parseLobbyForm(size, algorithm, roleStates, explicitSlots, {
      rules,
      customRoles,
      voteVisibility,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid lobby rules.");
      setSubmitting(false);
      return;
    }
    if (isPublic && !lobbyName.trim()) {
      setError("Enter a lobby name.");
      setSubmitting(false);
      return;
    }
    const body = {
      ...parsed.data,
      voteVisibility,
      directory: {
        public: isPublic,
        name: lobbyName.trim() || "Private lobby",
      },
    };
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
        <h1 className="text-3xl font-semibold tracking-tight">Create lobby</h1>
      </div>
      <div className="mt-5 max-w-xl">
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
                max={MAX_PLAYERS}
                value={size}
                aria-invalid={sizeInvalid}
                aria-describedby={
                  sizeInvalid ? "player-count-error" : undefined
                }
                onChange={(event) => setSize(event.target.value)}
              />
              {sizeInvalid ? (
                <p id="player-count-error" className="text-destructive text-sm">
                  Choose between 2 and {MAX_PLAYERS} players.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(event) => setIsPublic(event.target.checked)}
                />{" "}
                List publicly
              </label>
              {isPublic ? (
                <>
                  <Label htmlFor="lobby-name">Lobby name</Label>
                  <Input
                    id="lobby-name"
                    onBlur={() => setNameTouched(true)}
                    maxLength={60}
                    value={lobbyName}
                    aria-invalid={nameTouched && !lobbyName.trim()}
                    aria-describedby={
                      nameTouched && !lobbyName.trim()
                        ? "lobby-name-error"
                        : undefined
                    }
                    onChange={(event) => setLobbyName(event.target.value)}
                  />
                  {nameTouched && !lobbyName.trim() ? (
                    <p
                      id="lobby-name-error"
                      className="text-destructive text-sm"
                    >
                      Enter a lobby name.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="vote-visibility">Votes</Label>
              <select
                id="vote-visibility"
                className="bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={voteVisibility}
                onChange={(event) =>
                  setVoteVisibility(event.target.value as "public" | "hidden")
                }
              >
                <option value="public">Public votes</option>
                <option value="hidden">Hidden votes</option>
              </select>
            </div>
            {preview.success ? (
              <section aria-label="Setup summary" className="border-b py-4">
                <h2 className="font-semibold">Setup summary</h2>
                <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                  {summarizeGameSetup(preview.data).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {getSetupWarnings(preview.data).length ? (
                  <div className="mt-3 text-sm">
                    <h3 className="font-medium">Check your setup</h3>
                    <ul className="list-disc pl-5">
                      {getSetupWarnings(preview.data).map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
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
      </div>
      <details className="max-w-xl border-b py-3">
        <summary className="cursor-pointer font-semibold">
          Advanced setup
        </summary>
        <div className="space-y-4 pt-3">
          <div className="space-y-2">
            <Label>Role selection</Label>
            <div className="flex flex-wrap gap-2">
              {selectionAlgorithms.map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={algorithm === value ? "default" : "outline"}
                  aria-pressed={algorithm === value}
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
          {algorithm !== "explicit-slots" && algorithm !== "normal" ? (
            <p className="text-muted-foreground text-xs">
              {selectedCount} roles enabled
            </p>
          ) : null}

          {algorithm !== "explicit-slots" && algorithm !== "normal" ? (
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
                {roleOptions.map(([id, label]) => {
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
                          <div key={field} className="space-y-1">
                            <Label
                              htmlFor={id + "-" + field}
                              className="text-muted-foreground text-xs sm:sr-only"
                            >
                              {
                                {
                                  weight: "Weight",
                                  minimum: "Min",
                                  maximum: "Max",
                                  tier: "Tier",
                                }[field]
                              }
                            </Label>
                            <Input
                              id={id + "-" + field}
                              disabled={!role.enabled}
                              aria-label={`${label} ${field}`}
                              className="h-8"
                              type="number"
                              min="0"
                              placeholder={
                                field === "maximum" || field === "tier"
                                  ? "—"
                                  : "0"
                              }
                              value={role[field]}
                              onChange={(event) =>
                                updateRole(id, {
                                  [field]: event.target.value,
                                })
                              }
                            />
                          </div>
                        ),
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}
          <LobbyPresets getConfig={getConfig} onApply={applyConfig} />
          <GamePackPanel getConfig={getConfig} onApply={applyConfig} />
          <RulesEditor rules={rules} onChange={setRules} />
          <CustomRoleEditor roles={customRoles} onChange={updateCustomRoles} />
        </div>
      </details>
    </main>
  );
}
