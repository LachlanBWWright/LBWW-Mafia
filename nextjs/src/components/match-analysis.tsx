"use client";

import { useState } from "react";
import type {
  MatchReplay,
  MatchBalanceSummary,
} from "@mernmafia/shared/trpc/matchAnalysis";
import {
  filterReplayEvents,
  formatWinRate,
  matchOutcome,
  replayEventLabel,
  REPLAY_FILTERS,
  type ReplayFilter,
} from "@mernmafia/shared/game/replayPresentation";
import { Button } from "~/components/ui/button";

export function MatchReplayView({ replay }: { replay: MatchReplay }) {
  const [filter, setFilter] = useState<ReplayFilter>("all");
  const events = filterReplayEvents(replay.events, filter);
  return (
    <section className="space-y-5" aria-label={`Replay of match ${replay.id}`}>
      <div>
        <h3 className="text-xl font-semibold">Match #{replay.id} replay</h3>
        <p className="text-muted-foreground text-sm">
          {replay.roomName} · {matchOutcome(replay.winningFaction)}
        </p>
      </div>
      <div>
        <h4 className="mb-2 font-medium">Role reveal</h4>
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {replay.participants.map((player, index) => (
            <li
              key={`${player.username}-${index}`}
              className="flex justify-between gap-3 text-sm"
            >
              <span>{player.username}</span>
              <span className="text-muted-foreground">
                {player.role}
                {player.won ? " · Winner" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Replay filters">
        {REPLAY_FILTERS.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={filter === item.value ? "secondary" : "outline"}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {events.length === 0 ? (
        <p className="text-muted-foreground text-sm">No events in this view.</p>
      ) : (
        <ol className="divide-border border-border divide-y border-l pl-4">
          {events.map((event, index) => (
            <li key={`${event.time}-${index}`} className="py-3">
              <div className="text-muted-foreground flex flex-wrap justify-between gap-2 text-xs">
                <span>{replayEventLabel(event)}</span>
                <time dateTime={new Date(event.time).toISOString()}>
                  {new Date(event.time).toLocaleTimeString()}
                </time>
              </div>
              <p className="mt-1 text-sm break-words whitespace-pre-wrap">
                {event.content}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function MatchBalanceView({
  balance,
}: {
  balance: MatchBalanceSummary;
}) {
  return (
    <section className="space-y-5" aria-label="Game balance">
      <div>
        <h3 className="text-xl font-semibold">Game balance</h3>
        <p className="text-muted-foreground text-sm">
          {balance.sampleSize} completed matches · {balance.draws} draws
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Observed results depend on players and settings. Fewer than 20 games
          is a small sample.
        </p>
      </div>
      {!balance.sampleSize ? (
        <p className="text-muted-foreground text-sm">
          No completed matches available yet.
        </p>
      ) : (
        <>
          <BalanceTable
            title="By final role"
            rows={balance.roles.map((row) => ({ label: row.role, ...row }))}
          />
          <BalanceTable
            title="By final faction"
            rows={balance.factions.map((row) => ({
              label: row.faction,
              ...row,
            }))}
          />
          <div>
            <h4 className="mb-2 font-medium">By composition</h4>
            <div className="divide-border divide-y">
              {balance.compositions.map((row, index) => (
                <div className="space-y-1 py-3 text-sm" key={index}>
                  <p>{row.roles.join(", ")}</p>
                  <p className="text-muted-foreground">
                    {row.games} games · {row.draws} draws
                    {row.games < 20 ? " · Small sample" : ""}
                    {row.roster === "final" ? " · Final roster" : ""}
                  </p>
                  <p>
                    {row.wins
                      .map(
                        (result) =>
                          `${result.faction}: ${formatWinRate(result.winRate)} (${result.wins} wins)`,
                      )
                      .join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
function BalanceTable({
  title,
  rows,
}: {
  title: string;
  rows: {
    label: string;
    games: number;
    wins: number;
    draws: number;
    winRate: number;
  }[];
}) {
  return (
    <div>
      <h4 className="mb-2 font-medium">{title}</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pr-3 pb-2 font-normal">
                {title === "By final role" ? "Role" : "Faction"}
              </th>
              <th className="pr-3 pb-2 font-normal">Games</th>
              <th className="pr-3 pb-2 font-normal">Wins</th>
              <th className="pr-3 pb-2 font-normal">Draws</th>
              <th className="pb-2 font-normal">Win rate</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((row) => (
              <tr key={row.label}>
                <th className="py-2 pr-3 font-medium">
                  {row.label}
                  {row.games < 20 ? (
                    <span className="text-muted-foreground block text-xs font-normal">
                      Small sample
                    </span>
                  ) : null}
                </th>
                <td>{row.games}</td>
                <td>{row.wins}</td>
                <td>{row.draws}</td>
                <td>{formatWinRate(row.winRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
