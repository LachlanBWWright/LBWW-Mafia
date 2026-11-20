"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createUsePublicLobbies } from "@mernmafia/shared/game/usePublicLobbies";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

const usePublicLobbies = createUsePublicLobbies({
  useState,
  useEffect,
  useRef,
  useCallback,
});
export function PublicLobbies() {
  const { lobbies, next, status, load } = usePublicLobbies();
  const [query, setQuery] = useState("");
  const [joinable, setJoinable] = useState(false);
  const [seats, setSeats] = useState("0");
  const visible = lobbies.filter(
    (lobby) =>
      lobby.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!joinable ||
        (lobby.status === "waiting" && lobby.players < lobby.capacity)) &&
      lobby.capacity - lobby.players >= Number(seats),
  );
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Public lobbies</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={status === "loading"}
        >
          Refresh
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="lobby-search" className="text-sm">
            Search lobbies
          </label>
          <Input
            id="lobby-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={joinable}
            onChange={(event) => setJoinable(event.target.checked)}
          />{" "}
          Joinable only
        </label>
        <div>
          <label htmlFor="lobby-seats" className="text-sm">
            Open seats
          </label>
          <select
            id="lobby-seats"
            className="bg-background block rounded-md border p-2"
            value={seats}
            onChange={(event) => setSeats(event.target.value)}
          >
            <option value="0">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="4">4+</option>
          </select>
        </div>
      </div>
      {status === "loading" && !lobbies.length ? (
        <p role="status">Loading lobbies…</p>
      ) : status === "error" ? (
        <p role="alert">Unable to load public lobbies. Try refreshing.</p>
      ) : visible.length === 0 ? (
        <p className="text-muted-foreground">
          No matching lobbies in these results.
        </p>
      ) : (
        <ul>
          {visible.map((lobby) => (
            <li
              key={lobby.roomId}
              className="flex items-center justify-between gap-4 border-b py-3"
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{lobby.name}</p>
                <p className="text-muted-foreground text-sm">
                  ({lobby.players}/{lobby.capacity}) ·{" "}
                  {lobby.status === "waiting"
                    ? "Waiting"
                    : lobby.status === "in-progress"
                      ? "In progress"
                      : "Finished"}
                </p>
              </div>
              {lobby.status === "waiting" && lobby.players < lobby.capacity ? (
                <Button asChild>
                  <Link
                    href={`/lobby?room=${encodeURIComponent(lobby.roomId)}`}
                  >
                    Join
                  </Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {next !== null ? (
        <Button
          variant="outline"
          disabled={status === "loading"}
          onClick={() => void load(next)}
        >
          Load more
        </Button>
      ) : null}
    </>
  );
}
