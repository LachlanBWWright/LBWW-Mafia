"use client";
import profiles from "@mernmafia/shared/game/botProfiles.json";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useChatGPT } from "./useChatGPT";
import { chatGPTUsageUrl } from "@mernmafia/shared/game/chatGPTConnection";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ChatGPTIcon } from "~/components/chatgpt-icon";
import type { ChatGPTClient } from "@mernmafia/shared/game/chatGPTConnection";

const subscribeDesktop = () => () => undefined;

export function AiCharactersPanel(props: {
  roomId: string;
  initialOpen?: boolean;
  connectionClient?: ChatGPTClient;
}) {
  const native = useSyncExternalStore(
    subscribeDesktop,
    () => Boolean(window.mafiaDesktop),
    () => false,
  );
  if (!native && !props.connectionClient)
    return (
      <div className="max-w-sm space-y-1">
        <Button
          variant="outline"
          size="sm"
          disabled
          aria-describedby="chatgpt-browser-unavailable"
        >
          <Plus aria-hidden /> Add AI characters
        </Button>
        <p
          id="chatgpt-browser-unavailable"
          className="text-muted-foreground text-xs"
        >
          ChatGPT AI characters are available in the desktop and mobile apps.
          Browser sign-in is not supported yet.
        </p>
      </div>
    );
  return <NativeAiCharactersPanel {...props} />;
}

function NativeAiCharactersPanel({
  roomId,
  initialOpen = false,
  connectionClient,
}: {
  roomId: string;
  initialOpen?: boolean;
  connectionClient?: ChatGPTClient;
}) {
  const [personality, setPersonality] = useState("varied");
  const [difficulty, setDifficulty] = useState("standard");
  const [botCount, setBotCount] = useState("1");
  const [botMode, setBotMode] = useState("shared");
  const [requestedModel, setBotModel] = useState("");
  const [open, setOpen] = useState(initialOpen);
  const connection = useChatGPT(connectionClient);
  const botModels = connection.models;
  const [botStatus, setBotStatus] = useState("");
  const [startingBots, setStartingBots] = useState(false);
  const { refresh } = connection;
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);
  const botModel = botModels.some((model) => model.slug === requestedModel)
    ? requestedModel
    : (botModels[0]?.slug ?? "");
  const connectChatGPT = async () => {
    await connection.connect(() => undefined);
  };

  const addBotCharacters = async () => {
    setStartingBots(true);
    setBotStatus("");
    try {
      if (
        process.env.NEXT_PUBLIC_SOCKET_BACKEND &&
        process.env.NEXT_PUBLIC_SOCKET_BACKEND !== "partyserver"
      )
        throw new Error(
          "AI characters currently require the PartyServer game server.",
        );
      if (!botModels.some((model) => model.slug === botModel))
        throw new Error(
          "Load the available models and choose one before adding characters.",
        );
      const ticketResponse = await fetch("/api/account/game-ticket", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ count: Number(botCount) }),
      });
      const ticketBody = (await ticketResponse.json()) as {
        tokens?: string[];
        error?: string;
      };
      if (!ticketResponse.ok || !ticketBody.tokens?.length)
        throw new Error(ticketBody.error ?? "Could not create bot seats.");
      const bridgeBody = await connection.client.join(
        {
          socketUrl:
            process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:1999",
          room: roomId,
          tickets: ticketBody.tokens,
          personality,
          difficulty,
          mode: botMode,
          model: botModel,
        },
        AbortSignal.timeout(30_000),
      );
      setBotStatus(
        `${bridgeBody.added ?? ticketBody.tokens.length} bot character${ticketBody.tokens.length === 1 ? "" : "s"} joining.`,
      );
    } catch (error) {
      setBotStatus(
        error instanceof Error
          ? error.message
          : "Could not add bot characters.",
      );
    } finally {
      setStartingBots(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <Plus aria-hidden />
          Add AI characters
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/65" />
        <Dialog.Content className="bg-popover text-popover-foreground fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border p-5 shadow-2xl sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-xl font-semibold tracking-tight">
                Add AI characters
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground mt-1 text-sm">
                Use models from your ChatGPT account to fill the open seats.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close AI character setup"
              >
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <div className="space-y-4">
            <div className="space-y-3 border-b pb-4">
              {connection.account.connected ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {connection.account.email ??
                          connection.account.name ??
                          "ChatGPT connected"}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {connection.account.planEnabled
                          ? "ChatGPT plan usage enabled"
                          : "ChatGPT plan usage is off"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={connection.busy}
                      onClick={() => void connection.disconnect()}
                    >
                      Disconnect
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {!connection.account.planEnabled && (
                      <Button
                        disabled={connection.busy}
                        onClick={() => void connectChatGPT()}
                      >
                        Enable ChatGPT plan usage
                      </Button>
                    )}
                    <a
                      className="text-sm underline underline-offset-4"
                      href={chatGPTUsageUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Manage usage
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={connection.busy}
                      onClick={() => void connection.refresh()}
                    >
                      Reload models
                    </Button>
                    {connection.account.usagePaused && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={connection.busy}
                        onClick={() => void connection.retry()}
                      >
                        Retry after checking usage
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <Button
                  className="w-full border border-white/20 bg-black text-white hover:bg-black/85"
                  disabled={connection.busy}
                  onClick={() => void connectChatGPT()}
                >
                  <ChatGPTIcon />
                  {connection.busy ? "Connecting…" : "Continue with ChatGPT"}
                </Button>
              )}
              {connection.busy && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void connection.cancel()}
                >
                  Cancel
                </Button>
              )}
              {connection.message && (
                <p role="status" className="text-muted-foreground text-sm">
                  {connection.message}
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="min-w-0 text-sm">
                Characters
                <select
                  aria-label="Number of bots"
                  className="bg-background mt-1 h-11 w-full rounded-md border px-2 text-sm"
                  value={botCount}
                  onChange={(event) => setBotCount(event.target.value)}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((count) => (
                    <option key={count} value={count}>
                      {count} bot{count === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-sm">
                Context
                <select
                  aria-label="AI character mode"
                  className="bg-background mt-1 h-11 w-full rounded-md border px-2 text-sm"
                  value={botMode}
                  onChange={(event) => setBotMode(event.target.value)}
                >
                  <option value="shared">Shared model</option>
                  <option value="per-character">Separate contexts</option>
                </select>
              </label>
              <label className="min-w-0 text-sm sm:col-span-2">
                Model
                <select
                  aria-label="ChatGPT model"
                  className="bg-background mt-1 h-11 w-full rounded-md border px-2 text-sm"
                  value={botModel}
                  onChange={(event) => setBotModel(event.target.value)}
                  disabled={!botModels.length}
                >
                  {botModels.length ? (
                    botModels.map((model) => (
                      <option key={model.slug} value={model.slug}>
                        {model.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Connect ChatGPT to choose a model</option>
                  )}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                Personality
                <select
                  aria-label="Bot personality"
                  className="bg-background mt-1 h-11 w-full rounded-md border px-2"
                  value={personality}
                  onChange={(event) => setPersonality(event.target.value)}
                >
                  <option value="varied">Varied</option>
                  {profiles.personalities.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                Difficulty
                <select
                  aria-label="Bot difficulty"
                  className="bg-background mt-1 h-11 w-full rounded-md border px-2"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                >
                  {profiles.difficulties.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-muted-foreground text-xs">
              {difficulty === "casual"
                ? "Simple deductions and fewer accusations."
                : difficulty === "challenging"
                  ? "Stronger evidence requirements, more accusations, and more bluffing."
                  : "Balanced deductions, accusations, and bluffing."}
            </p>
            <Button
              size="sm"
              onClick={() => void addBotCharacters()}
              disabled={
                startingBots ||
                connection.busy ||
                !botModels.length ||
                !connection.account.planEnabled ||
                connection.account.usagePaused
              }
            >
              {startingBots ? "Starting…" : "Add characters"}
            </Button>
            {botStatus ? (
              <p role="status" className="text-muted-foreground text-xs">
                {botStatus}
              </p>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
