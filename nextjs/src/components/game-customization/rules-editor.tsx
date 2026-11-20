"use client";

import type { ResolvedGameRules } from "@mernmafia/shared/game/gameCustomization";

const control = "bg-background h-9 w-full rounded-md border px-2 text-sm";
type Props = {
  rules: ResolvedGameRules;
  onChange: (rules: ResolvedGameRules) => void;
};
type Group = keyof ResolvedGameRules;

export function RulesEditor({ rules, onChange }: Props) {
  function update(
    group: Group,
    field: string,
    value: string | number | boolean,
  ) {
    onChange({ ...rules, [group]: { ...rules[group], [field]: value } });
  }
  return (
    <section aria-label="Game rules" className="divide-y border-y">
      <details open className="py-4">
        <summary className="cursor-pointer font-semibold">
          Pace and voting
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(
            [
              ["daySeconds", "Day duration", 10, 900],
              ["nightSeconds", "Night duration", 5, 300],
              ["firstDaySeconds", "Opening discussion", 5, 900],
            ] as const
          ).map(([field, label, min, max]) => (
            <label key={field} className="grid gap-2 text-sm">
              {label} (seconds)
              <input
                className={control}
                type="number"
                min={min}
                max={max}
                value={rules.timing[field]}
                onChange={(event) =>
                  update("timing", field, event.currentTarget.valueAsNumber)
                }
              />
            </label>
          ))}
          <label className="grid gap-2 text-sm">
            Voting method
            <select
              className={control}
              value={rules.voting.method}
              onChange={(event) =>
                update("voting", "method", event.target.value)
              }
            >
              <option value="majority">Majority required</option>
              <option value="plurality">Most votes wins</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Tied votes
            <select
              className={control}
              value={rules.voting.tie}
              onChange={(event) => update("voting", "tie", event.target.value)}
            >
              <option value="none">No elimination</option>
              <option value="random">Random tied player</option>
            </select>
          </label>
        </div>
        <div className="mt-4 grid gap-3 text-sm">
          <label>
            <input
              type="checkbox"
              checked={rules.timing.earlyEnd}
              onChange={(event) =>
                update("timing", "earlyEnd", event.target.checked)
              }
            />{" "}
            Finish phases when everyone submits
          </label>
          <label>
            <input
              type="checkbox"
              checked={rules.voting.allowRevote}
              onChange={(event) =>
                update("voting", "allowRevote", event.target.checked)
              }
            />{" "}
            Allow players to change their vote
          </label>
        </div>
      </details>
      <details className="py-4">
        <summary className="cursor-pointer font-semibold">
          Information and communication
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm">
            Death reveals
            <select
              className={control}
              value={rules.reveal.onDeath}
              onChange={(event) =>
                update("reveal", "onDeath", event.target.value)
              }
            >
              <option value="role">Full role</option>
              <option value="faction">Faction only</option>
              <option value="none">Nothing</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Messages per phase (0 = unlimited)
            <input
              className={control}
              type="number"
              min="0"
              max="100"
              value={rules.communication.messageLimit}
              onChange={(event) =>
                update(
                  "communication",
                  "messageLimit",
                  event.currentTarget.valueAsNumber,
                )
              }
            />
          </label>
          {(
            [
              ["reveal", "rolePool", "Show possible roles before starting"],
              ["communication", "whispers", "Allow whispers"],
              ["communication", "lastWords", "Allow last words"],
              ["communication", "observerChat", "Allow spectator chat"],
            ] as const
          ).map(([group, field, label]) => (
            <label key={field} className="text-sm">
              <input
                type="checkbox"
                checked={
                  field === "rolePool"
                    ? rules.reveal.rolePool
                    : rules.communication[field]
                }
                onChange={(event) => update(group, field, event.target.checked)}
              />{" "}
              {label}
            </label>
          ))}
        </div>
      </details>
      <details className="py-4">
        <summary className="cursor-pointer font-semibold">
          Bots and atmosphere
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={rules.bots.fillEmptySeats}
              onChange={(event) =>
                update("bots", "fillEmptySeats", event.target.checked)
              }
            />{" "}
            Fill empty seats with bots when starting
          </label>
          <label className="grid gap-2 text-sm">
            Bot difficulty
            <select
              className={control}
              value={rules.bots.difficulty}
              onChange={(event) =>
                update("bots", "difficulty", event.target.value)
              }
            >
              {["casual", "standard", "challenging"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Bot personality
            <select
              className={control}
              value={rules.bots.personality}
              onChange={(event) =>
                update("bots", "personality", event.target.value)
              }
            >
              {["cautious", "argumentative", "deceptive"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Room theme
            <select
              className={control}
              value={rules.presentation.theme}
              onChange={(event) =>
                update("presentation", "theme", event.target.value)
              }
            >
              {["classic", "noir", "midnight"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            Announcements
            <select
              className={control}
              value={rules.presentation.announcementStyle}
              onChange={(event) =>
                update("presentation", "announcementStyle", event.target.value)
              }
            >
              <option value="classic">Classic</option>
              <option value="concise">Concise</option>
            </select>
          </label>
        </div>
      </details>
    </section>
  );
}
