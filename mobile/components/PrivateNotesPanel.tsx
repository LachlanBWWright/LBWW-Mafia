import { useEffect, useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import * as SecureStore from "expo-secure-store";
import { Button, Input } from "./ui";
import {
  createPrivateNotesRepository,
  emptyPrivateNotes,
  PRIVATE_FIELD_LIMIT,
  PRIVATE_NOTE_LIMIT,
  updatePrivatePlayer,
  type PrivateNotes,
  type PrivateNotesLobby,
  type Suspicion,
} from "../../shared/game/privateNotes";
import { chunkedPrivateNotesStorage } from "../../shared/game/privateNotesStorage";

export function PrivateNotesPanel({
  lobby,
  ownerId = "guest",
}: {
  lobby: PrivateNotesLobby;
  ownerId?: string;
}) {
  return (
    <PrivateNotesEditor
      key={JSON.stringify([lobby.matchId, lobby.playerName, ownerId])}
      lobby={lobby}
      ownerId={ownerId}
    />
  );
}

function PrivateNotesEditor({
  lobby,
  ownerId,
}: {
  lobby: PrivateNotesLobby;
  ownerId: string;
}) {
  const matchId = lobby.matchId ?? "";
  const [value, setValue] = useState<PrivateNotes>(() =>
    emptyPrivateNotes(matchId, lobby.playerName, ownerId),
  );
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const repository = useMemo(
    () =>
      createPrivateNotesRepository(
        chunkedPrivateNotesStorage({
          getItem: async (key) =>
            Platform.OS === "web"
              ? globalThis.localStorage.getItem(key)
              : SecureStore.getItemAsync(key),
          setItem: async (key, raw) =>
            Platform.OS === "web"
              ? globalThis.localStorage.setItem(key, raw)
              : SecureStore.setItemAsync(key, raw),
          removeItem: async (key) =>
            Platform.OS === "web"
              ? globalThis.localStorage.removeItem(key)
              : SecureStore.deleteItemAsync(key),
        }),
      ),
    [],
  );
  useEffect(() => {
    let active = true;
    if (!matchId || !lobby.playerName) return;
    void repository
      .load(matchId, lobby.playerName, ownerId)
      .then((saved) => {
        if (active) {
          setValue(saved);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setStatus(
            "Notes could not be loaded. Changes will remain here until you leave.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [matchId, lobby.playerName, ownerId, repository]);
  const enabled =
    ready &&
    value.matchId === matchId &&
    value.playerName === lobby.playerName &&
    value.ownerId === ownerId;
  const save = (next: PrivateNotes) => {
    if (!enabled) return;
    setValue(next);
    void repository
      .save(next)
      .then(() => {
        setStatus("Saved on this device.");
      })
      .catch(() => {
        setStatus(
          "Could not save notes on this device. Keep this page open to retain your changes.",
        );
      });
  };
  const clear = () => {
    setValue(emptyPrivateNotes(matchId, lobby.playerName, ownerId));
    void repository
      .clear(matchId, lobby.playerName, ownerId)
      .then(() => {
        setStatus("Notes cleared.");
      })
      .catch(() => {
        setStatus("Could not clear saved notes. Try again.");
      });
  };
  return (
    <View className="gap-md border-t border-border pt-lg">
      <View className="flex-row items-center justify-between gap-sm">
        <Text className="text-lg font-bold text-foreground">Private notes</Text>
        <Button variant="ghost" size="sm" disabled={!enabled} onPress={clear}>
          Clear notes
        </Button>
      </View>
      <Text className="text-sm text-muted-foreground">
        Only you can see these notes. They stay on this device for this match.
      </Text>
      {!matchId || !lobby.playerName ? (
        <Text className="text-sm text-muted-foreground">
          Join a match to start taking notes.
        </Text>
      ) : (
        <>
          <Text className="text-sm text-foreground">Match notes</Text>
          <Input
            accessibilityLabel="Match notes"
            multiline
            editable={enabled}
            maxLength={PRIVATE_NOTE_LIMIT}
            value={enabled ? value.notes : ""}
            onChangeText={(notes) => save({ ...value, notes })}
          />
          <Text className="font-bold text-foreground">Suspicion board</Text>
          {lobby.players.map(({ name }) => {
            const row = enabled
              ? value.board.find((item) => item.name === name)
              : undefined;
            const update = (patch: Parameters<typeof updatePrivatePlayer>[2]) =>
              save(updatePrivatePlayer(value, name, patch));
            return (
              <View key={name} className="gap-sm border-b border-border pb-md">
                <Text className="font-bold text-foreground">{name}</Text>
                <View className="flex-row flex-wrap gap-xs">
                  {(
                    [
                      ["unknown", "Uncertain"],
                      ["trusted", "Trusted"],
                      ["suspicious", "Suspicious"],
                    ] as const
                  ).map(([suspicion, label]) => (
                    <Button
                      key={suspicion}
                      disabled={!enabled}
                      size="sm"
                      variant={
                        (row?.suspicion ?? "unknown") === suspicion
                          ? "secondary"
                          : "ghost"
                      }
                      accessibilityLabel={`${label}: ${name}`}
                      accessibilityState={{
                        selected: (row?.suspicion ?? "unknown") === suspicion,
                      }}
                      onPress={() =>
                        update({ suspicion: suspicion as Suspicion })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </View>
                <Text className="text-sm text-foreground">Claim</Text>
                <Input
                  accessibilityLabel={`Claim for ${name}`}
                  editable={enabled}
                  maxLength={PRIVATE_FIELD_LIMIT}
                  value={row?.claim ?? ""}
                  onChangeText={(claim) => update({ claim })}
                />
                <Text className="text-sm text-foreground">Confirmed fact</Text>
                <Input
                  accessibilityLabel={`Confirmed fact for ${name}`}
                  editable={enabled}
                  maxLength={PRIVATE_FIELD_LIMIT}
                  value={row?.confirmedFact ?? ""}
                  onChangeText={(confirmedFact) => update({ confirmedFact })}
                />
              </View>
            );
          })}
          <Text
            className="text-xs text-muted-foreground"
            accessibilityLiveRegion="polite"
          >
            {status || (ready ? "" : "Loading notes…")}
          </Text>
        </>
      )}
    </View>
  );
}
