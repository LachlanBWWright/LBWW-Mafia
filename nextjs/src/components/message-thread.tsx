"use client";
import type { DirectMessage } from "@mernmafia/shared/trpc/appRouter";
import { ReportPlayer } from "./report-player";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export type MessageThreadProps = {
  messages: DirectMessage[];
  reportUserId?: string;
  hasOlder: boolean;
  sending: boolean;
  draft: string;
  onOlder: () => void;
  onDraft: (value: string) => void;
  onSend: () => void;
};
export function MessageThread({
  messages,
  reportUserId,
  hasOlder,
  sending,
  draft,
  onOlder,
  onDraft,
  onSend,
}: MessageThreadProps) {
  return (
    <>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-md border p-3">
        {hasOlder ? (
          <Button variant="ghost" size="sm" onClick={onOlder}>
            Load older messages
          </Button>
        ) : null}
        {!messages.length ? (
          <p className="text-muted-foreground text-sm">No messages yet.</p>
        ) : null}
        {messages.map((message) => (
          <div key={message.id} className="bg-muted/50 rounded-md p-2 text-sm">
            <p>{message.body}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {message.senderName ?? "Player"} ·{" "}
              {new Intl.DateTimeFormat(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              }).format(new Date(message.createdAt))}
            </p>
            {message.senderId === reportUserId ? (
              <ReportPlayer
                userId={message.senderId}
                name={message.senderName ?? "Player"}
                initialMessageId={message.id}
              />
            ) : null}
          </div>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <Input
          value={draft}
          maxLength={2000}
          onChange={(event) => onDraft(event.target.value)}
          placeholder="Write a message…"
          aria-label="Message"
        />
        <Button disabled={sending || !draft.trim()}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </form>
    </>
  );
}
