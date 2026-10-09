import React from "react";
import { Text, View } from "react-native";
import type { DirectMessage } from "../../shared/trpc/appRouter";
import { ReportPlayer } from "./ReportPlayer";
import { Button, Input } from "./ui";
export function MessageThread({
  messages,
  reportUserId,
  hasOlder,
  loadingOlder,
  sending,
  draft,
  onOlder,
  onDraft,
  onSend,
}: {
  messages: DirectMessage[];
  reportUserId?: string;
  hasOlder: boolean;
  loadingOlder: boolean;
  sending: boolean;
  draft: string;
  onOlder: () => void;
  onDraft: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <View className="gap-3">
      {hasOlder && messages.length ? (
        <Button variant="ghost" disabled={loadingOlder} onPress={onOlder}>
          Load older messages
        </Button>
      ) : null}
      <View className="gap-2">
        {messages.map((message) => (
          <View
            key={message.id}
            className="gap-1 rounded border border-border p-2"
          >
            <Text className="text-sm text-foreground">{message.body}</Text>
            <Text className="text-xs text-muted-foreground">
              {message.senderName ?? "Player"} ·{" "}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(message.createdAt))}
            </Text>
            {message.senderId === reportUserId ? (
              <ReportPlayer
                userId={message.senderId}
                name={message.senderName ?? "Player"}
                initialMessageId={message.id}
              />
            ) : null}
          </View>
        ))}
      </View>
      <Input
        accessibilityLabel="Message"
        value={draft}
        onChangeText={onDraft}
        placeholder="Write a message"
        maxLength={2000}
        multiline
      />
      <Button onPress={onSend} disabled={sending || !draft.trim()}>
        {sending ? "Sending…" : "Send"}
      </Button>
    </View>
  );
}
