import { View } from "react-native";
import { useState } from "react";
import type { LobbyState } from "../../shared/game/lobbyState";
import { fixtureLobbyActions } from "../../shared/testing/matchFixtures";
import { LobbyView } from "./LobbyView";

const ignorePracticeChange = (_value: boolean) => undefined;
const ignoreSpectate = () => undefined;

export function MatchExperienceStory({ lobby, initialTab = "players" }: { lobby: LobbyState; initialTab?: "chat" | "players" }) {
  const [draft, setDraft] = useState(lobby.messageDraft);
  const [messages, setMessages] = useState(lobby.messages);
  return (
    <View className="flex-1 w-full">
      <LobbyView
        lobby={{ ...lobby, ...fixtureLobbyActions, messages, messageDraft: draft, setMessageDraft: setDraft, sendMessage: () => { if (draft.trim()) setMessages((current) => [...current, { id: (current.at(-1)?.id ?? 0) + 1, text: `${lobby.playerName}: ${draft.trim()}`, sender: lobby.playerName, kind: "chat" }]); setDraft(""); } }}
        roomId="storybook-match"
        onPracticeChange={ignorePracticeChange}
        onSpectate={ignoreSpectate}
        initialTab={initialTab}
      />
    </View>
  );
}
