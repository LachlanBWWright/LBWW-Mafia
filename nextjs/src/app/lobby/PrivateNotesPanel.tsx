"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  createPrivateNotesRepository,
  emptyPrivateNotes,
  PRIVATE_FIELD_LIMIT,
  PRIVATE_NOTE_LIMIT,
  updatePrivatePlayer,
  type PrivateNotes,
  type PrivateNotesLobby,
  type Suspicion,
} from "@mernmafia/shared/game/privateNotes";

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
      createPrivateNotesRepository({
        getItem: async (key) => window.localStorage.getItem(key),
        setItem: async (key, raw) => window.localStorage.setItem(key, raw),
        removeItem: async (key) => window.localStorage.removeItem(key),
      }),
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
    <section className="space-y-4 border-t pt-4" aria-label="Private notes">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Private notes</h3>
        <Button variant="ghost" size="sm" disabled={!enabled} onClick={clear}>
          Clear notes
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Only you can see these notes. They stay on this device for this match.
      </p>
      {!matchId || !lobby.playerName ? (
        <p className="text-muted-foreground text-sm">
          Join a match to start taking notes.
        </p>
      ) : (
        <>
          <label className="block space-y-1 text-sm">
            <span>Match notes</span>
            <textarea
              className="bg-background min-h-24 w-full rounded-md border p-3"
              disabled={!enabled}
              maxLength={PRIVATE_NOTE_LIMIT}
              value={enabled ? value.notes : ""}
              onChange={(event) =>
                save({ ...value, notes: event.target.value })
              }
            />
          </label>
          <h4 className="font-medium">Suspicion board</h4>
          {lobby.players.map(({ name }) => {
            const row = enabled
              ? value.board.find((item) => item.name === name)
              : undefined;
            const update = (patch: Parameters<typeof updatePrivatePlayer>[2]) =>
              save(updatePrivatePlayer(value, name, patch));
            return (
              <div key={name} className="space-y-2 border-b pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{name}</span>
                  <label className="text-sm">
                    <span className="sr-only">Suspicion for {name}</span>
                    <select
                      disabled={!enabled}
                      className="bg-background rounded border p-2"
                      value={row?.suspicion ?? "unknown"}
                      onChange={(event) =>
                        update({ suspicion: event.target.value as Suspicion })
                      }
                    >
                      <option value="unknown">Uncertain</option>
                      <option value="trusted">Trusted</option>
                      <option value="suspicious">Suspicious</option>
                    </select>
                  </label>
                </div>
                <label className="block space-y-1 text-sm">
                  <span>Claim</span>
                  <input
                    className="bg-background w-full rounded border p-2"
                    disabled={!enabled}
                    maxLength={PRIVATE_FIELD_LIMIT}
                    value={row?.claim ?? ""}
                    onChange={(event) => update({ claim: event.target.value })}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span>Confirmed fact</span>
                  <input
                    className="bg-background w-full rounded border p-2"
                    disabled={!enabled}
                    maxLength={PRIVATE_FIELD_LIMIT}
                    value={row?.confirmedFact ?? ""}
                    onChange={(event) =>
                      update({ confirmedFact: event.target.value })
                    }
                  />
                </label>
              </div>
            );
          })}
          <p className="text-muted-foreground text-xs" role="status">
            {status || (ready ? "" : "Loading notes…")}
          </p>
        </>
      )}
    </section>
  );
}
