"use client";
import { useState } from "react";
import type { MatchReplay } from "@mernmafia/shared/trpc/matchAnalysis";
import type { MatchDiscussion } from "@mernmafia/shared/trpc/gameCommunity";
import {
  campaignFailure,
  publicDiscussionEvents,
} from "@mernmafia/shared/game/campaignPresentation";
import { gameCommunityClient } from "./game-community-client";
import { Button } from "./ui/button";

export function MatchDiscussionPanel({ replay }: { replay: MatchReplay }) {
  const [discussion, setDiscussion] = useState<MatchDiscussion | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [eventIndex, setEventIndex] = useState("0"),
    [nomineeId, setNomineeId] = useState("");
  const events = publicDiscussionEvents(replay);
  async function run(operation?: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation?.();
      setDiscussion(
        await gameCommunityClient.community.discussion.query({
          matchId: replay.id,
        }),
      );
      if (operation) setText("");
    } catch (failure) {
      setError(campaignFailure(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="space-y-4 border-t pt-5"
      aria-label="Post-game discussion"
    >
      <h3 className="text-xl font-semibold">Post-game discussion</h3>
      <Button variant="outline" disabled={busy} onClick={() => void run()}>
        {discussion ? "Refresh discussion" : "Open discussion"}
      </Button>
      {error ? <p role="alert">{error}</p> : null}
      {busy ? <p role="status">Loading discussion…</p> : null}
      {discussion ? (
        <>
          <ul className="divide-y">
            {discussion.annotations.map((annotation) => (
              <li key={annotation.id} className="space-y-1 py-3">
                <p className="text-muted-foreground text-sm">
                  {annotation.authorName ?? "Player"} · Event{" "}
                  {annotation.eventIndex + 1}
                </p>
                <p className="break-words whitespace-pre-wrap">
                  {annotation.text}
                </p>
                {annotation.authorId === discussion.viewerId ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        gameCommunityClient.community.deleteAnnotation.mutate({
                          matchId: replay.id,
                          annotationId: annotation.id,
                        }),
                      )
                    }
                  >
                    Delete annotation
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {!discussion.annotations.length ? <p>No annotations yet.</p> : null}
          {events.length ? (
            <>
              <label className="block space-y-1">
                Replay event
                <select
                  className="bg-background border-input block w-full rounded border p-2"
                  value={eventIndex}
                  onChange={(event) => setEventIndex(event.target.value)}
                >
                  {events.map((event, index) => (
                    <option key={`${event.time}-${index}`} value={index}>
                      {index + 1}. {event.content.slice(0, 100)}
                    </option>
                  ))}
                </select>
              </label>
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(() =>
                    gameCommunityClient.community.annotate.mutate({
                      matchId: replay.id,
                      eventIndex: Number(eventIndex),
                      text: text.trim(),
                    }),
                  );
                }}
              >
                <label className="block">
                  Annotation
                  <textarea
                    className="border-input block w-full rounded border p-2"
                    required
                    maxLength={1000}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                </label>
                <Button disabled={busy || !text.trim()}>Add annotation</Button>
              </form>
              <label className="block">
                Decisive player
                <select
                  className="bg-background border-input block w-full rounded border p-2"
                  value={nomineeId}
                  onChange={(event) => setNomineeId(event.target.value)}
                >
                  <option value="">Choose a player</option>
                  {discussion.participants.map((player) => (
                    <option key={player.userId} value={player.userId}>
                      {player.name ?? "Unnamed player"}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                disabled={busy || !nomineeId.trim()}
                onClick={() =>
                  void run(() =>
                    gameCommunityClient.community.nominate.mutate({
                      matchId: replay.id,
                      eventIndex: Number(eventIndex),
                      nomineeId: nomineeId.trim(),
                    }),
                  )
                }
              >
                Nominate decisive play
              </Button>
            </>
          ) : (
            <p>This match has no public events to annotate.</p>
          )}
          <p>{discussion.nominations.length} decisive play nominations</p>
        </>
      ) : null}
    </section>
  );
}
