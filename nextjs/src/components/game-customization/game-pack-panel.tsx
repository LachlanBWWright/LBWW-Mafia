"use client";
import { useState } from "react";
import type { LobbyConfig } from "@mernmafia/shared/game/lobbyConfig";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  downloadPack,
  makePackDocument,
  makePackLink,
  readPackInput,
} from "./game-pack-actions";

export function GamePackPanel({
  getConfig,
  onApply,
}: {
  getConfig: () => LobbyConfig;
  onApply: (config: LobbyConfig) => void;
}) {
  const [name, setName] = useState("My game pack");
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  function run(action: () => void) {
    try {
      action();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to read game pack.",
      );
    }
  }
  function load(input: string) {
    const pack = readPackInput(input);
    onApply(pack.config);
    setName(pack.name);
    setStatus(`${pack.name} loaded.`);
  }
  return (
    <details className="border-b py-4">
      <summary className="cursor-pointer font-semibold">
        Import and share a game pack
      </summary>
      <div className="mt-4 space-y-4">
        <label className="grid gap-2 text-sm">
          Pack name
          <Input
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              run(() => {
                setText(makePackDocument(name, getConfig()));
                setStatus("Pack ready to copy.");
              })
            }
          >
            Export JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => run(() => downloadPack(name, getConfig()))}
          >
            Download pack
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              run(() => {
                setText(
                  makePackLink(window.location.origin, name, getConfig()),
                );
                setStatus("Share link ready to copy.");
              })
            }
          >
            Create share link
          </Button>
          <Button
            variant="outline"
            onClick={() => run(() => load(window.location.href))}
          >
            Load pack from link
          </Button>
        </div>
        <label className="grid gap-2 text-sm">
          Pack JSON or share link
          <textarea
            className="bg-background min-h-32 w-full rounded-md border p-3 font-mono text-xs"
            value={text}
            maxLength={300000}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={!text.trim()}
            onClick={() => run(() => load(text))}
          >
            Import pack
          </Button>
          <label className="text-sm">
            Open pack file
            <input
              className="ml-2 max-w-full"
              type="file"
              accept=".json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 100000) {
                  setStatus("Game packs must be smaller than 100 KB.");
                  return;
                }
                void file
                  .text()
                  .then((input) => run(() => load(input)))
                  .catch(() => setStatus("Unable to read pack file."));
              }}
            />
          </label>
        </div>
        {status ? (
          <p role="status" className="text-sm">
            {status}
          </p>
        ) : null}
      </div>
    </details>
  );
}
