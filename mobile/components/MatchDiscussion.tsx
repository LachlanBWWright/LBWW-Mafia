import React, { useState } from "react";
import { Text, View } from "react-native";
import type { MatchReplay } from "../../shared/trpc/matchAnalysis";
import type { MatchDiscussion } from "../../shared/trpc/gameCommunity";
import {
  campaignFailure,
  publicDiscussionEvents,
} from "../../shared/game/campaignPresentation";
import { trpcClient } from "../lib/trpc";
import { Button, Input } from "./ui";
export function MatchDiscussionPanel({ replay }: { replay: MatchReplay }) {
  const [discussion, setDiscussion] = useState<MatchDiscussion | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [text, setText] = useState(""),
    [eventIndex, setEventIndex] = useState("1"),
    [nomineeId, setNomineeId] = useState("");
  const events = publicDiscussionEvents(replay);
  const index = Number(eventIndex) - 1;
  const validIndex =
    Number.isInteger(index) && index >= 0 && index < events.length;
  async function run(operation?: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation?.();
      setDiscussion(
        await trpcClient.community.discussion.query({ matchId: replay.id }),
      );
      if (operation) setText("");
    } catch (failure) {
      setError(campaignFailure(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="gap-4 border-t border-border pt-5">
      <Text className="text-xl font-bold text-foreground">
        Post-game discussion
      </Text>
      <Button variant="outline" disabled={busy} onPress={() => void run()}>
        {discussion ? "Refresh discussion" : "Open discussion"}
      </Button>
      {error ? (
        <Text accessibilityRole="alert" className="text-destructive">
          {error}
        </Text>
      ) : null}
      {busy ? (
        <Text className="text-foreground">Loading discussion…</Text>
      ) : null}
      {discussion ? (
        <>
          {discussion.annotations.map((annotation) => (
            <View
              key={annotation.id}
              className="gap-1 border-b border-border py-3"
            >
              <Text className="text-muted-foreground">
                {annotation.authorName ?? "Player"} · Event{" "}
                {annotation.eventIndex + 1}
              </Text>
              <Text className="text-foreground">{annotation.text}</Text>
              {annotation.authorId === discussion.viewerId ? (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onPress={() =>
                    void run(() =>
                      trpcClient.community.deleteAnnotation.mutate({
                        matchId: replay.id,
                        annotationId: annotation.id,
                      }),
                    )
                  }
                >
                  Delete annotation
                </Button>
              ) : null}
            </View>
          ))}
          {!discussion.annotations.length ? (
            <Text className="text-muted-foreground">No annotations yet.</Text>
          ) : null}
          {events.length ? (
            <>
              <Text className="text-foreground">
                Replay event number (1–{events.length})
              </Text>
              <Input
                accessibilityLabel="Replay event number"
                keyboardType="number-pad"
                value={eventIndex}
                onChangeText={setEventIndex}
              />
              {validIndex ? (
                <Text className="text-muted-foreground">
                  {events[index]?.content}
                </Text>
              ) : null}
              <Text className="text-foreground">Annotation</Text>
              <Input
                accessibilityLabel="Annotation"
                multiline
                maxLength={1000}
                value={text}
                onChangeText={setText}
              />
              <Button
                disabled={busy || !validIndex || !text.trim()}
                onPress={() =>
                  void run(() =>
                    trpcClient.community.annotate.mutate({
                      matchId: replay.id,
                      eventIndex: index,
                      text: text.trim(),
                    }),
                  )
                }
              >
                Add annotation
              </Button>
              <Text className="text-foreground">Decisive player</Text>
              {discussion.participants.map((player) => (
                <Button
                  key={player.userId}
                  variant={
                    nomineeId === player.userId ? "secondary" : "outline"
                  }
                  accessibilityState={{ selected: nomineeId === player.userId }}
                  onPress={() => setNomineeId(player.userId)}
                >
                  {player.name ?? "Unnamed player"}
                </Button>
              ))}
              <Button
                disabled={busy || !validIndex || !nomineeId.trim()}
                onPress={() =>
                  void run(() =>
                    trpcClient.community.nominate.mutate({
                      matchId: replay.id,
                      eventIndex: index,
                      nomineeId: nomineeId.trim(),
                    }),
                  )
                }
              >
                Nominate decisive play
              </Button>
            </>
          ) : (
            <Text className="text-muted-foreground">
              This match has no public events to annotate.
            </Text>
          )}
          <Text className="text-foreground">
            {discussion.nominations.length} decisive play nominations
          </Text>
        </>
      ) : null}
    </View>
  );
}
