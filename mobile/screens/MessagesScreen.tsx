import { randomUUID } from "expo-crypto";
import { MessageThread } from "../components/MessageThread";
import { runInForeground } from "../lib/foreground";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  DirectConversationSummary,
  DirectMessage,
  SocialUser,
} from "../../shared/trpc/appRouter";
import { StackParamList } from "../App";
import {
  Card,
  EmptyState,
  ListRow,
  Screen,
  SectionHeader,
} from "../components/ui";
import { trpcClient } from "../lib/trpc";

import {
  mergeDirectMessages,
  MESSAGE_PAGE_SIZE,
  MESSAGE_REFRESH_MS,
} from "../../shared/game/directMessages";

type Props = NativeStackScreenProps<StackParamList, "Messages">;

export function MessagesScreen({ navigation }: Props) {
  const [conversations, setConversations] = useState<
    DirectConversationSummary[]
  >([]);
  const [friends, setFriends] = useState<SocialUser[]>([]);
  const [selected, setSelected] = useState<SocialUser | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const pendingSend = useRef<{ key: string; id: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const selectedId = useRef<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [c, f] = await Promise.all([
        trpcClient.messages.conversations.query(),
        trpcClient.social.friends.query(),
      ]);
      setConversations(c);
      setFriends(f.filter((x) => x.relationship === "friend"));
      setError("");
    } catch {
      setError("Unable to load messages.");
    }
  }, []);
  const loadThread = useCallback(async (user: SocialUser, before?: number) => {
    try {
      const result = await trpcClient.messages.thread.query({
        otherUserId: user.id,
        limit: MESSAGE_PAGE_SIZE,
        before,
      });
      if (selectedId.current !== user.id) return;
      setSelected(result.otherUser ?? user);
      setMessages((current) => mergeDirectMessages(current, result.messages));
      if (before || (!before && result.messages.length < MESSAGE_PAGE_SIZE))
        setHasOlder(result.messages.length === MESSAGE_PAGE_SIZE);
      if (result.conversationId)
        await trpcClient.messages.read.mutate({
          conversationId: result.conversationId,
        });
    } catch {
      setError("Unable to load this conversation.");
    }
  }, []);
  const selectUser = (user: SocialUser) => {
    selectedId.current = user.id;
    setSelected(user);
    setMessages([]);
    setHasOlder(true);
    setDraft("");
    setError("");
    void loadThread(user);
  };
  useEffect(
    () => runInForeground(() => void load(), MESSAGE_REFRESH_MS),
    [load],
  );
  const otherUserId = selected?.id;
  const selectedUser = useRef(selected);
  selectedUser.current = selected;
  useEffect(() => {
    if (!otherUserId) return;
    return runInForeground(() => {
      if (selectedUser.current) void loadThread(selectedUser.current);
    }, MESSAGE_REFRESH_MS);
  }, [loadThread, otherUserId]);
  async function send() {
    if (!selected || !draft.trim() || sending) return;
    const recipient = selected;
    setSending(true);
    setError("");
    try {
      const key = JSON.stringify([recipient.id, draft]);
      if (pendingSend.current?.key !== key)
        pendingSend.current = { key, id: randomUUID() };
      await trpcClient.messages.send.mutate({
        commandId: pendingSend.current.id,
        recipientId: recipient.id,
        body: draft,
      });
      pendingSend.current = null;
      if (selectedId.current === recipient.id) setDraft("");
      await Promise.all([loadThread(recipient), load()]);
    } catch {
      setError("Unable to send message.");
    } finally {
      setSending(false);
    }
  }
  async function loadOlder() {
    if (!selected || !messages[0] || loadingOlder) return;
    setLoadingOlder(true);
    try {
      await loadThread(selected, messages[0].id);
    } finally {
      setLoadingOlder(false);
    }
  }
  const available = friends.filter(
    (friend) =>
      !conversations.some(
        (conversation) => conversation.otherUser.id === friend.id,
      ),
  );
  return (
    <Screen
      navigation={navigation}
      activeRoute="Messages"
      title="Messages"
      subtitle="Private conversations with your friends."
    >
      <Card>
        <SectionHeader title="Conversations" />
        {conversations.map((conversation) => (
          <ListRow
            key={conversation.id}
            onPress={() => selectUser(conversation.otherUser)}
            title={`${conversation.otherUser.name ?? "Player"}${conversation.unread ? " · Unread" : ""}${conversation.otherUser.isOnline ? " · Online" : ""}`}
            subtitle={conversation.lastMessage?.body ?? "No messages yet"}
            tone={
              selected?.id === conversation.otherUser.id ? "success" : "default"
            }
          />
        ))}
        {available.length ? (
          <>
            <SectionHeader title="Start a conversation" />
            {available.map((friend) => (
              <ListRow
                key={friend.id}
                onPress={() => selectUser(friend)}
                title={friend.name ?? friend.handle ?? "Player"}
                subtitle="Friend"
              />
            ))}
          </>
        ) : null}
        {!conversations.length && !available.length ? (
          <EmptyState
            title="No conversations yet"
            description="Add friends in Community to start messaging."
          />
        ) : null}
      </Card>
      <Card>
        <SectionHeader
          title={
            selected
              ? `${selected.name ?? "Conversation"}${selected.isOnline ? " · Online" : " · Offline"}`
              : "Choose a conversation"
          }
        />
        {selected ? (
          <MessageThread
            reportUserId={selected.id}
            messages={messages}
            hasOlder={hasOlder}
            loadingOlder={loadingOlder}
            sending={sending}
            draft={draft}
            onOlder={() => void loadOlder()}
            onDraft={setDraft}
            onSend={() => void send()}
          />
        ) : (
          <Text className="text-sm text-muted-foreground">
            Select a friend to start messaging.
          </Text>
        )}
        {error ? (
          <Text className="text-sm text-destructive">{error}</Text>
        ) : null}
      </Card>
    </Screen>
  );
}
