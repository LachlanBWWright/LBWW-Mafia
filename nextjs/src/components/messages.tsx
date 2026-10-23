"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type {
  AppRouter,
  DirectConversationSummary,
  DirectMessage,
  SocialUser,
} from "@mernmafia/shared/trpc/appRouter";
import { MessageThread } from "./message-thread";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

import {
  mergeDirectMessages,
  MESSAGE_PAGE_SIZE,
  MESSAGE_REFRESH_MS,
} from "@mernmafia/shared/game/directMessages";

const makeClient = () =>
  createTRPCProxyClient<AppRouter>({
    links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
  });

export function Messages() {
  const [client] = useState(makeClient);
  const [conversations, setConversations] = useState<
    DirectConversationSummary[]
  >([]);
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedOther, setSelectedOther] = useState<SocialUser | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const pendingSend = useRef<{ key: string; id: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const selectedRef = useRef<string | null>(null);

  const loadConversations = useCallback(async () => {
    const [nextConversations, nextFriends] = await Promise.all([
      client.messages.conversations.query(),
      client.social.friends.query(),
    ]);
    setConversations(nextConversations);
    setFriends(
      nextFriends.filter((friend) => friend.relationship === "friend"),
    );
    setLoading(false);
  }, [client]);

  const loadThread = useCallback(
    async (otherUserId: string, before?: number) => {
      const result = await client.messages.thread.query({
        otherUserId,
        limit: MESSAGE_PAGE_SIZE,
        before,
      });
      if (selectedRef.current !== otherUserId) return;
      setSelectedOther(result.otherUser);
      setMessages((current) => mergeDirectMessages(current, result.messages));
      if (before || result.messages.length < MESSAGE_PAGE_SIZE)
        setHasOlder(result.messages.length === MESSAGE_PAGE_SIZE);
      if (result.conversationId) {
        await client.messages.read.mutate({
          conversationId: result.conversationId,
        });
      }
    },
    [client],
  );

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void loadConversations().catch(() => {
        setError("Unable to load messages.");
        setLoading(false);
      });
    }, 0);
    return () => window.clearTimeout(initial);
  }, [loadConversations]);

  useEffect(() => {
    const events = new EventSource("/api/messages/events");
    const refresh = () => {
      if (selectedUserId)
        void loadThread(selectedUserId).catch(() => undefined);
      void loadConversations().catch(() => undefined);
    };
    events.addEventListener("message", refresh);
    const initial = window.setTimeout(() => {
      if (selectedUserId)
        void loadThread(selectedUserId).catch(() =>
          setError("Unable to load this conversation."),
        );
    }, 0);
    const timer = window.setInterval(() => {
      if (selectedUserId)
        void loadThread(selectedUserId).catch(() => undefined);
      void loadConversations().catch(() => undefined);
    }, MESSAGE_REFRESH_MS);
    return () => {
      events.close();
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadConversations, loadThread, selectedUserId]);

  const availableFriends = useMemo(
    () =>
      friends.filter(
        (friend) =>
          !conversations.some(
            (conversation) => conversation.otherUser.id === friend.id,
          ),
      ),
    [conversations, friends],
  );

  function selectUser(user: SocialUser) {
    selectedRef.current = user.id;
    setHasOlder(true);
    setDraft("");
    setSelectedUserId(user.id);
    setSelectedOther(user);
    setMessages([]);
    setError(null);
  }

  async function send() {
    if (!selectedUserId || !draft.trim() || sending) return;
    const recipientId = selectedUserId;
    setSending(true);
    setError(null);
    try {
      const key = JSON.stringify([recipientId, draft]);
      if (pendingSend.current?.key !== key)
        pendingSend.current = { key, id: crypto.randomUUID() };
      await client.messages.send.mutate({
        commandId: pendingSend.current.id,
        recipientId,
        body: draft,
      });
      pendingSend.current = null;
      if (selectedRef.current === recipientId) setDraft("");
      await Promise.all([loadThread(recipientId), loadConversations()]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to send message.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-5 space-y-1">
        <h1 className="text-2xl font-semibold">Messages</h1>
        <p className="text-muted-foreground text-sm">
          Private conversations with your friends.
        </p>
      </div>
      <div className="grid min-h-[520px] gap-4 md:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {loading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : null}
            {!loading && !conversations.length ? (
              <p className="text-muted-foreground text-sm">
                No conversations yet.
              </p>
            ) : null}
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => selectUser(conversation.otherUser)}
                className={`hover:bg-muted w-full rounded-md p-2 text-left text-sm ${selectedUserId === conversation.otherUser.id ? "bg-muted" : ""}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${conversation.otherUser.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                      aria-label={
                        conversation.otherUser.isOnline ? "Online" : "Offline"
                      }
                    />
                    <span className="truncate font-medium">
                      {conversation.otherUser.name ??
                        conversation.otherUser.handle ??
                        "Player"}
                    </span>
                  </span>
                  {conversation.unread ? (
                    <span
                      className="bg-primary h-2 w-2 shrink-0 rounded-full"
                      aria-label="Unread"
                    />
                  ) : null}
                </span>
                <span className="text-muted-foreground line-clamp-1 text-xs">
                  {conversation.lastMessage?.body ?? "No messages yet"}
                </span>
              </button>
            ))}
            {availableFriends.length ? (
              <div className="mt-4 border-t pt-3">
                <p className="text-muted-foreground mb-2 text-xs font-medium">
                  Start a conversation
                </p>
                {availableFriends.map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => selectUser(friend)}
                    className="hover:bg-muted block w-full rounded-md p-2 text-left text-sm"
                  >
                    {friend.name ?? friend.handle ?? "Player"}
                  </button>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card className="flex min-h-0 flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {selectedOther ? (
                <>
                  <span
                    className={`h-2 w-2 rounded-full ${selectedOther.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                  />
                  {selectedOther.name ?? selectedOther.handle ?? "Conversation"}
                  <span className="text-muted-foreground text-xs font-normal">
                    {selectedOther.isOnline ? "Online" : "Offline"}
                  </span>
                </>
              ) : (
                "Choose a conversation"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            {!selectedUserId ? (
              <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
                Select a friend to start messaging.
              </div>
            ) : (
              <MessageThread
                reportUserId={selectedUserId}
                messages={messages}
                hasOlder={hasOlder}
                sending={sending}
                draft={draft}
                onDraft={setDraft}
                onSend={() => void send()}
                onOlder={() => {
                  const first = messages[0];
                  if (first)
                    void loadThread(selectedUserId, first.id).catch(() =>
                      setError("Unable to load older messages."),
                    );
                }}
              />
            )}
            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
