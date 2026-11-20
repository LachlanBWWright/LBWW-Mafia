"use client";
import * as React from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@mernmafia/shared/trpc/appRouter";
import {
  gameStatus,
  gamePhase,
  type AdminGamePage,
  type AdminGameQuery,
} from "@mernmafia/shared/admin/games";
import { createUseAdminGames } from "@mernmafia/shared/admin/useAdminGames";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const client = createTRPCProxyClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});
const load = (query: AdminGameQuery, signal: AbortSignal) =>
  client.admin.games.query(query, { signal });
const useAdminGames = createUseAdminGames(React);

export function AdminGameList({ page }: { page: AdminGamePage }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">
        Checked {new Date(page.checkedAt).toLocaleTimeString()}
      </p>
      {page.games.length === 0 && (
        <p className="py-4 text-sm">No games found.</p>
      )}
      {page.games.map((game) => (
        <article
          key={game.roomId}
          className="border-border space-y-2 border-b py-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">{game.name}</h3>
            <span className="text-sm">{gameStatus(game.state)}</span>
          </div>
          <p className="text-muted-foreground font-mono text-xs break-all">
            {game.roomId}
          </p>
          <p className="text-muted-foreground text-sm">
            {game.visibility === "public" ? "Public" : "Link-only"}
          </p>
          {game.state ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Players</dt>
                <dd>
                  {game.state.players} / {game.state.capacity}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Connections</dt>
                <dd>{game.state.connections}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reserved seats</dt>
                <dd>{game.state.reservedSeats}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phase</dt>
                <dd>{gamePhase(game.state)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-foreground text-sm font-medium">
              Room could not be reached. Refresh to retry.
            </p>
          )}
          {game.state?.roster && (
            <details className="text-sm">
              <summary className="focus-visible:outline-ring cursor-pointer rounded py-1 focus-visible:outline-2">
                View players
              </summary>
              <ul className="divide-border divide-y">
                {game.state.roster.map((player) => (
                  <li
                    key={player.name}
                    className="flex flex-wrap justify-between gap-2 py-2"
                  >
                    <span>
                      {player.name}
                      {player.isBot ? " · Bot" : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {player.connected ? "Connected" : "Disconnected"}
                      {player.alive === null
                        ? ""
                        : player.alive
                          ? " · Alive"
                          : " · Eliminated"}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {game.state?.historyPending && (
            <p className="text-foreground text-sm font-medium">
              Match history awaiting save · {game.state.historyAttempts}{" "}
              attempts
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
export function AdminGames({ loadGames = load }: { loadGames?: typeof load }) {
  const { page, loading, error, refresh, query, setQuery } =
    useAdminGames(loadGames);
  const [roomId, setRoomId] = React.useState("");
  return (
    <section aria-labelledby="admin-games-title" className="mb-8 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="admin-games-title" className="text-xl font-semibold">
          Games
        </h2>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery({
            offset: 0,
            ...(roomId.trim() ? { roomId: roomId.trim() } : {}),
          });
        }}
      >
        <Input
          aria-label="Room ID"
          placeholder="Room ID"
          maxLength={64}
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          className="min-w-0 flex-1"
        />
        <Button disabled={loading}>Find room</Button>
        {query.roomId && (
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              setRoomId("");
              setQuery({ offset: 0 });
            }}
          >
            All games
          </Button>
        )}
      </form>
      {error && (
        <p role="alert" className="text-foreground text-sm font-medium">
          {error}
        </p>
      )}
      {page && <AdminGameList page={page} />}
      <div className="flex gap-2">
        {query.offset > 0 && (
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => setQuery({ offset: Math.max(0, query.offset - 10) })}
          >
            Previous
          </Button>
        )}
        {page?.nextOffset != null && (
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => setQuery({ offset: page.nextOffset! })}
          >
            Next
          </Button>
        )}
      </div>
    </section>
  );
}
