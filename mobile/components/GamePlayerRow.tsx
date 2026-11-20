import { Text, View } from "react-native";
import { visitActionIcon } from "../../shared/game/actionIcon";
import { ActionIcon } from "./ActionIcon";
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
import { RoleIcon } from "./RoleIcon";
import { PlayerAvatar } from "./PlayerAvatar";
import { NotebookPen } from "lucide-react-native";
type Lobby = LobbyState & LobbyActions;
export function GamePlayerRow({
  player,
  index,
  lobby,
  hasNote = false,
  onNotes,
  highlighted = false,
}: {
  player: PlayerList;
  index: number;
  lobby: Lobby;
  hasNote?: boolean;
  onNotes?: (name: string) => void;
  highlighted?: boolean;
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
    (lobby.action.vote === undefined ||
      (lobby.time === "Day" && !!lobby.setup?.rules.voting.allowRevote)) &&
    canVoteTarget({
      time: lobby.time,
      isSelf: self,
      actorAlive: alive,
      targetAlive: player.isAlive !== false,
      canVote: lobby.canVote,
      nightVote: lobby.visitCapability.nightVote,
    });
  const canWhisper =
    lobby.setup?.rules.communication.whispers !== false &&
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
  const votes = voteSummary(lobby.players, lobby.voteVisibility, lobby.setup?.rules.voting.method);
  return (
    <View
      className={`gap-2 border-b border-border px-2 py-3 ${highlighted ? "bg-accent" : selected ? "bg-primary/10" : player.isAlive === false ? "bg-destructive/5" : ""}`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <PlayerAvatar name={player.name} preset={player.avatarPreset} anonymous={lobby.started} />
        <View className="min-w-0 flex-1">
          <Text
            className={`text-sm font-semibold ${player.isAlive === false ? "text-muted-foreground" : "text-foreground"}`}
          >
            {player.name}
            {self ? " (You)" : ""}
          </Text>
          {player.role || player.faction ? (
            <View className="flex-row items-center gap-1">
            {player.role ? <RoleIcon role={player.role} size={14} /> : null}
            <Text className="text-xs text-muted-foreground">
              {player.role ?? player.faction}
            </Text>
            </View>
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
              {votes?.required ? ` / ${votes.required} needed` : ""}
              {votes?.leaders.includes(player.name) ? " · Leading" : ""}
            </Text>
          ) : null}
        </View>
        <View className="flex-row gap-2">
          {onNotes && lobby.started ? <Button accessibilityLabel={`${hasNote ? "Edit" : "Add"} private note for ${player.name}`} variant="ghost" className="min-h-11 w-11 px-0" onPress={() => onNotes(player.name)}><View className="flex-row items-center"><NotebookPen size={17} color="#A8B4D9" />{hasNote ? <View className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}</View></Button> : null}
          {showVisit ? (
            <Button
              accessibilityLabel={`${roleVisitLabel(lobby.currentUserRole, lobby.time)} ${player.name}`}
              variant={
                lobby.action.visit === player.name ? "primary" : "outline"
              }
              className="min-h-11 px-3"
              onPress={() => lobby.visitPlayer(index)}
              disabled={!canVisit}
            >
              <View className="flex-row items-center gap-1">
                <ActionIcon action={visitActionIcon(lobby.currentUserRole, lobby.time)} size={15} color={lobby.action.visit === player.name ? "#0b1020" : "#e9eeff"} />
                <Text className="text-sm font-bold text-foreground">{roleVisitLabel(lobby.currentUserRole, lobby.time)}</Text>
              </View>
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
              <ActionIcon action="vote" size={19} />
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
              <ActionIcon action="whisper" size={19} />
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  );
}
