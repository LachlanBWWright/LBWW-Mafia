"use client";
import { useState } from "react";
import {
  createCustomRoleDraft,
  type CustomRole,
} from "@mernmafia/shared/game/customRoles";
import { requestRoleSandbox } from "@mernmafia/shared/game/roleSandboxClient";
import type { RoleSandboxResult } from "@mernmafia/shared/game/roleSandbox";
import { CustomRoleEditor } from "~/components/game-customization/custom-role-editor";
import { Button } from "~/components/ui/button";
export function RoleSandbox({
  run = requestRoleSandbox,
}: {
  run?: typeof requestRoleSandbox;
}) {
  const [roles, setRoles] = useState<CustomRole[]>(() => [
    createCustomRoleDraft(),
  ]);
  const [selected, setSelected] = useState("field-medic");
  const [nights, setNights] = useState(3);
  const [targetAlignment, setAlignment] = useState<"town" | "mafia">("mafia");
  const [incomingAttack, setAttack] = useState(true);
  const [result, setResult] = useState<RoleSandboxResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function simulate() {
    const role = roles.find((item) => item.id === selected);
    if (!role) {
      setError("Choose a role to test.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await run({ role, nights, targetAlignment, incomingAttack }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to run sandbox.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Repeat a night action against the same target to inspect charges,
        cooldowns and targeting restrictions. Another player attacks the target
        when incoming attack is enabled. Investigation samples are fixed at
        zero.
      </p>
      <fieldset disabled={busy} className="space-y-4">
        <CustomRoleEditor roles={roles} onChange={setRoles} />
        <label className="block">
          Role to test
          <select
            aria-label="Role to test"
            className="bg-background ml-3 rounded border p-2"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Choose role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Nights
          <input
            aria-label="Nights"
            className="bg-background ml-3 w-20 rounded border p-2"
            type="number"
            min={1}
            max={5}
            value={nights}
            onChange={(event) => setNights(Number(event.target.value))}
          />
        </label>
        <label className="block">
          Target alignment
          <select
            aria-label="Target alignment"
            className="bg-background ml-3 rounded border p-2"
            value={targetAlignment}
            onChange={(event) =>
              setAlignment(event.target.value === "town" ? "town" : "mafia")
            }
          >
            <option value="mafia">Mafia</option>
            <option value="town">Town</option>
          </select>
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={incomingAttack}
            onChange={(event) => setAttack(event.target.checked)}
          />
          Incoming attack
        </label>
        <Button
          onClick={() => void simulate()}
          disabled={busy || !roles.some((role) => role.id === selected)}
        >
          {busy ? "Running…" : "Run scenario"}
        </Button>
      </fieldset>
      {error ? (
        <p role="alert" className="text-red-300 [.light_&]:text-red-700">
          {error}
        </p>
      ) : null}
      {result ? (
        <section aria-label="Scenario results" className="space-y-4">
          <h2 className="text-xl font-semibold">Scenario results</h2>
          {result.nights.map((night) => (
            <div key={night.night} className="border-b pb-3">
              <h3 className="font-medium">
                Night {night.night}:{" "}
                {night.accepted ? "Action accepted" : "Action rejected"}
              </h3>
              <p>
                Target damage: {night.targetDamage} · Defence:{" "}
                {night.targetDefence} · Blocked:{" "}
                {night.targetBlocked ? "yes" : "no"} · Redirected to actor:{" "}
                {night.redirectedToActor ? "yes" : "no"}
              </p>
              {night.notices.map((notice, index) => (
                <p key={index}>{notice}</p>
              ))}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
