import * as React from "react";
import { Text, View } from "react-native";
import {
  gameStatus,
  gamePhase,
  type AdminGamePage,
  type AdminGameQuery,
} from "../../shared/admin/games";
import { createUseAdminGames } from "../../shared/admin/useAdminGames";
import { trpcClient } from "../lib/trpc";
import { Button, Input, SectionHeader } from "./ui";
const useAdminGames = createUseAdminGames(React);
const load = (query: AdminGameQuery, signal: AbortSignal) =>
  trpcClient.admin.games.query(query, { signal });

export function AdminGameList({ page }: { page: AdminGamePage }) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  return (
    <View>
      <Text className="text-xs text-muted-foreground">
        Checked {new Date(page.checkedAt).toLocaleTimeString()}
      </Text>
      {page.games.length === 0 && (
        <Text className="py-4 text-sm text-foreground">No games found.</Text>
      )}
      {page.games.map((game) => (
        <View key={game.roomId} className="gap-2 border-b border-border py-4">
          <View className="flex-row flex-wrap justify-between gap-2">
            <Text className="font-semibold text-foreground">{game.name}</Text>
            <Text className="text-sm text-foreground">
              {gameStatus(game.state)}
            </Text>
          </View>
          <Text selectable className="text-xs text-muted-foreground">
            {game.roomId}
          </Text>
          <Text className="text-sm text-muted-foreground">
            {game.visibility === "public" ? "Public" : "Link-only"}
          </Text>
          {game.state ? (
            <View className="gap-1">
              <Text className="text-sm text-foreground">
                Players: {game.state.players} / {game.state.capacity}
              </Text>
              <Text className="text-sm text-foreground">
                Connections: {game.state.connections}
              </Text>
              <Text className="text-sm text-foreground">
                Reserved seats: {game.state.reservedSeats}
              </Text>
              <Text className="text-sm text-foreground">
                Phase: {gamePhase(game.state)}
              </Text>
            </View>
          ) : (
            <Text className="text-sm text-foreground font-medium">
              Room could not be reached. Refresh to retry.
            </Text>
          )}
          {game.state?.roster && (
            <View className="gap-2">
              <Button
                variant="secondary"
                accessibilityLabel={`${expanded === game.roomId ? "Hide" : "View"} players in ${game.name}`}
                onPress={() =>
                  setExpanded(expanded === game.roomId ? null : game.roomId)
                }
              >
                {expanded === game.roomId ? "Hide players" : "View players"}
              </Button>
              {expanded === game.roomId &&
                game.state.roster.map((player) => (
                  <View
                    key={player.name}
                    className="gap-1 border-b border-border py-2"
                  >
                    <Text className="text-sm text-foreground">
                      {player.name}
                      {player.isBot ? " · Bot" : ""}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {player.connected ? "Connected" : "Disconnected"}
                      {player.alive === null
                        ? ""
                        : player.alive
                          ? " · Alive"
                          : " · Eliminated"}
                    </Text>
                  </View>
                ))}
            </View>
          )}
          {game.state?.historyPending && (
            <Text className="text-sm text-foreground font-medium">
              Match history awaiting save · {game.state.historyAttempts}{" "}
              attempts
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
export function AdminGames({ loadGames = load }: { loadGames?: typeof load }) {
  const { page, loading, error, refresh, query, setQuery } =
    useAdminGames(loadGames);
  const [roomId, setRoomId] = React.useState("");
  return (
    <View className="gap-3">
      <SectionHeader title="Games" />
      <Button
        variant="secondary"
        disabled={loading}
        onPress={() => void refresh()}
      >
        {loading ? "Loading…" : "Refresh"}
      </Button>
      <Input
        accessibilityLabel="Room ID"
        placeholder="Room ID"
        maxLength={64}
        value={roomId}
        onChangeText={setRoomId}
        autoCapitalize="none"
      />
      <Button
        disabled={loading}
        onPress={() =>
          setQuery({
            offset: 0,
            ...(roomId.trim() ? { roomId: roomId.trim() } : {}),
          })
        }
      >
        Find room
      </Button>
      {query.roomId && (
        <Button
          variant="secondary"
          disabled={loading}
          onPress={() => {
            setRoomId("");
            setQuery({ offset: 0 });
          }}
        >
          All games
        </Button>
      )}
      {error ? (
        <Text
          accessibilityRole="alert"
          className="text-sm text-foreground font-medium"
        >
          {error}
        </Text>
      ) : null}
      {page && <AdminGameList page={page} />}
      {query.offset > 0 && (
        <Button
          variant="secondary"
          disabled={loading}
          onPress={() => setQuery({ offset: Math.max(0, query.offset - 10) })}
        >
          Previous
        </Button>
      )}
      {page?.nextOffset != null && (
        <Button
          variant="secondary"
          disabled={loading}
          onPress={() => setQuery({ offset: page.nextOffset! })}
        >
          Next
        </Button>
      )}
    </View>
  );
}
