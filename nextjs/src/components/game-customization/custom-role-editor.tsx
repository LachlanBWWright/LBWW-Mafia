"use client";
import { useState } from "react";
import {
  createCustomRoleDraft,
  customRoleSchema,
  customRoleEffects,
  describeCustomRole,
  type CustomRole,
} from "@mernmafia/shared/game/customRoles";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
const select = "bg-background h-9 w-full rounded-md border px-2 text-sm";
export function CustomRoleEditor({
  roles,
  onChange,
}: {
  roles: CustomRole[];
  onChange: (roles: CustomRole[]) => void;
}) {
  const [draft, setDraft] = useState(createCustomRoleDraft);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  function patch(patch: Partial<CustomRole>) {
    setDraft((current) => ({ ...current, ...patch }));
    setError("");
  }
  function save() {
    const parsed = customRoleSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid role.");
      return;
    }
    if (
      roles.some((role) => role.id === parsed.data.id && role.id !== editing)
    ) {
      setError("Choose a unique role ID.");
      return;
    }
    onChange([...roles.filter((role) => role.id !== editing), parsed.data]);
    setEditing(null);
    setDraft({ ...createCustomRoleDraft(), id: "new-role", name: "New role" });
    setError("");
  }
  return (
    <details className="border-b py-4">
      <summary className="cursor-pointer font-semibold">
        Custom roles and variants
      </summary>
      <div className="mt-4 space-y-5">
        {roles.length ? (
          <ul className="divide-y">
            {roles.map((role) => (
              <li
                key={role.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                  <p className="font-medium">{role.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {describeCustomRole(role)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Role ID: custom:{role.id}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraft(role);
                    setEditing(role.id);
                    setError("");
                  }}
                >
                  Edit {role.name}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    onChange(roles.filter((item) => item.id !== role.id))
                  }
                >
                  Remove {role.name}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-3 font-medium">
            {editing ? "Edit role" : "Create a role"}
          </legend>
          <label className="grid gap-2 text-sm">
            Role name
            <Input
              value={draft.name}
              maxLength={60}
              onChange={(event) => patch({ name: event.target.value })}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Role ID
            <Input
              value={draft.id}
              disabled={editing !== null}
              maxLength={40}
              onChange={(event) => patch({ id: event.target.value })}
            />
          </label>
          <label className="grid gap-2 text-sm">
            Alignment
            <select
              className={select}
              value={draft.alignment}
              onChange={(event) =>
                patch({
                  alignment: event.target.value === "mafia" ? "mafia" : "town",
                })
              }
            >
              <option value="town">Town</option>
              <option value="mafia">Mafia</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Night ability
            <select
              className={select}
              value={draft.effect}
              onChange={(event) => {
                const effect = customRoleEffects.find(
                  (value) => value === event.target.value,
                );
                if (effect)
                  patch({
                    effect,
                    investigationAccuracy: 100,
                    target: effect === "redirect" ? "other" : draft.target,
                  });
              }}
            >
              {customRoleEffects.map((effect) => (
                <option key={effect}>{effect}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Targets
            <select
              className={select}
              disabled={draft.effect === "redirect"}
              value={draft.target}
              onChange={(event) =>
                patch({
                  target: event.target.value === "any" ? "any" : "other",
                })
              }
            >
              <option value="other">Other players</option>
              <option value="any">Anyone, including self</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Ability uses (blank = unlimited)
            <Input
              type="number"
              min="1"
              max="64"
              value={draft.charges ?? ""}
              onChange={(event) =>
                patch({
                  charges: event.target.value
                    ? event.currentTarget.valueAsNumber
                    : undefined,
                })
              }
            />
          </label>
          <label className="grid gap-2 text-sm">
            Cooldown nights
            <Input
              type="number"
              min="0"
              max="10"
              value={draft.cooldownNights}
              onChange={(event) =>
                patch({ cooldownNights: event.currentTarget.valueAsNumber })
              }
            />
          </label>
          {draft.effect === "investigate" ? (
            <label className="grid gap-2 text-sm">
              Investigation accuracy (%)
              <Input
                type="number"
                min="0"
                max="100"
                value={draft.investigationAccuracy}
                onChange={(event) =>
                  patch({
                    investigationAccuracy: event.currentTarget.valueAsNumber,
                  })
                }
              />
            </label>
          ) : null}
          <label className="text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.noRepeatTarget}
              onChange={(event) =>
                patch({ noRepeatTarget: event.target.checked })
              }
            />{" "}
            No consecutive target
          </label>
          <label className="grid gap-2 text-sm sm:col-span-2">
            Flavour text
            <textarea
              className="bg-background min-h-20 rounded-md border p-2"
              maxLength={500}
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </label>
        </fieldset>
        <p className="text-muted-foreground text-sm">
          Abilities trigger at night. Roles win with their faction.
          {draft.effect === "redirect"
            ? " Redirect sends the selected player’s action to you."
            : ""}
        </p>
        {error ? (
          <p role="alert" className="text-sm">
            {error}
          </p>
        ) : null}
        <Button variant="outline" onClick={save}>
          {editing ? "Save role" : "Add custom role"}
        </Button>
      </div>
    </details>
  );
}
