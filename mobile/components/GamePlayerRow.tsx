import { Text, View } from "react-native";
import { CheckCircle2, MessageSquare } from "lucide-react-native";
import {
  canPerformVisit,
  canVoteTarget,
  canWhisperTarget,
  shouldShowVisitAction,
} from "../../shared/game/playerActionRules";
import { roleVisitLabel } from "../../shared/game/lobbyPresentation";
import { voteSummary } from "../../shared/game/matchExperience";
import type { PlayerList } from "../../shared/communication/events";
import type { LobbyState, LobbyActions } from "../lib/useGameLobby";
import { Button } from "./ui";
type Lobby = LobbyState & LobbyActions;
export function GamePlayerRow({
  player,
  index,
  lobby,
}: {
  player: PlayerList;
  index: number;
  lobby: Lobby;
}) {
  const self = player.name === lobby.playerName;
  const alive =
    lobby.players.find((entry) => entry.name === lobby.playerName)?.isAlive !==
    false;
  const enabled =
    lobby.connected &&
    !!lobby.started &&
    !lobby.ended &&
    lobby.participation !== "spectator" &&
    lobby.participation !== "eliminated";
  const showVisit = shouldShowVisitAction(lobby.time, lobby.visitCapability);
  const canVisit =
    enabled &&
    canPerformVisit({
      time: lobby.time,
      isSelf: self,
      targetAlive: player.isAlive !== false,
      actorAlive: alive,
      actorRole: lobby.currentUserRole,
      targetRole: player.role,
      capability: lobby.visitCapability,
    });
  const canVote =
    enabled &&
    lobby.action.vote === undefined &&
    canVoteTarget({
      time: lobby.time,
      isSelf: self,
      actorAlive: alive,
      targetAlive: player.isAlive !== false,
      canVote: lobby.canVote,
      nightVote: lobby.visitCapability.nightVote,
    });
  const canWhisper =
    enabled &&
    lobby.canTalk &&
    canWhisperTarget({
      time: lobby.time,
      isSelf: self,
      targetAlive: player.isAlive !== false,
      hasMessage: !!lobby.messageDraft.trim(),
    });
  const selected =
    lobby.action.visit === player.name || lobby.action.vote === player.name;
  const votes = voteSummary(lobby.players, lobby.voteVisibility);
  return (
    <View
      className={`gap-2 border-b border-border px-2 py-3 ${selected ? "bg-primary/10" : player.isAlive === false ? "bg-destructive/5" : ""}`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text
            className={`text-sm font-semibold ${player.isAlive === false ? "text-muted-foreground" : "text-foreground"}`}
          >
            {player.name}
            {self ? " (You)" : ""}
          </Text>
          {player.role ? (
            <Text className="text-xs text-muted-foreground">{player.role}</Text>
          ) : null}
          <Text className="text-xs text-muted-foreground">
            {player.isAlive === false
              ? "Eliminated"
              : player.connected === false
                ? "Disconnected"
                : lobby.messages.at(-1)?.sender === player.name
                  ? "Last spoke"
                  : ""}
            {!lobby.ended && player.voteStatus
              ? ` · ${player.voteStatus === "pending" ? "Not voted" : player.voteStatus === "abstained" ? "Abstained" : `Voted${player.voteTarget ? ` for ${player.voteTarget}` : ""}`}`
              : ""}
          </Text>
          {!lobby.ended && player.votesReceived !== undefined ? (
            <Text
              className={`text-xs ${votes?.leaders.includes(player.name) ? "font-semibold text-primary" : "text-muted-foreground"}`}
            >
              {player.votesReceived} vote{player.votesReceived === 1 ? "" : "s"}
              {votes?.leaders.includes(player.name) ? " · Leading" : ""}
            </Text>
          ) : null}
        </View>
        <View className="flex-row gap-2">
          {showVisit ? (
            <Button
              accessibilityLabel={`Visit ${player.name}`}
              variant={
                lobby.action.visit === player.name ? "primary" : "outline"
              }
              className="min-h-11 px-3"
              onPress={() => lobby.visitPlayer(index)}
              disabled={!canVisit}
            >
              {roleVisitLabel(lobby.currentUserRole, lobby.time)}
            </Button>
          ) : null}
          {lobby.time === "Day" || lobby.visitCapability.nightVote ? (
            <Button
              accessibilityLabel={`Vote for ${player.name}`}
              variant={
                lobby.action.vote === player.name ? "primary" : "secondary"
              }
              className="min-h-11 w-11 px-0"
              onPress={() => lobby.voteForPlayer(index)}
              disabled={!canVote}
            >
              <CheckCircle2 size={19} color="#E9EEFF" />
            </Button>
          ) : null}
          {lobby.time === "Day" ? (
            <Button
              accessibilityLabel={`Whisper to ${player.name}`}
              variant="outline"
              className="min-h-11 w-11 px-0"
              onPress={() => lobby.whisperToPlayer(index)}
              disabled={!canWhisper}
            >
              <MessageSquare size={19} color="#E9EEFF" />
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  );
}
