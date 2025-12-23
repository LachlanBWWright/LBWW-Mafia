import type { Time } from "~/types/shared";

export abstract class AbstractSocketClient {
  // Listener arrays for each event type
  protected receiveMessageListeners: ((msg: string) => void)[] = [];
  protected receiveChatMessageListeners: ((msg: string) => void)[] = [];
  protected receiveWhisperMessageListeners: ((msg: string) => void)[] = [];
  protected receivePlayerListListeners: ((
    playerList: {
      name: string;
      isAlive?: boolean;
      role?: string;
    }[],
  ) => void)[] = [];
  protected receiveNewPlayerListeners: ((player: { name: string }) => void)[] =
    [];
  protected removePlayerListeners: ((player: { name: string }) => void)[] = [];
  protected assignPlayerRoleListeners: ((player: {
    name: string;
    role: string;
    dayVisitSelf: boolean;
    dayVisitOthers: boolean;
    dayVisitFaction: boolean;
    nightVisitSelf: boolean;
    nightVisitOthers: boolean;
    nightVisitFaction: boolean;
    nightVote: boolean;
  }) => void)[] = [];
  protected updateFactionRoleListeners: ((data: {
    name: string;
    role: string;
  }) => void)[] = [];
  protected updatePlayerRoleListeners: ((data: {
    name: string;
    role?: string;
  }) => void)[] = [];
  protected updatePlayerVisitListeners: (() => void)[] = [];
  protected updateDayTimeListeners: ((data: {
    time: Time;
    dayNumber: number;
    timeLeft: number;
  }) => void)[] = [];
  protected disableVotingListeners: (() => void)[] = [];
  protected blockMessagesListeners: (() => void)[] = [];

  // --- Abstract methods: all must be consecutive ---
  abstract sendPlayerJoinRoom(
    captchaToken: string,
    cb: (result: string | number) => void,
  ): void;
  abstract sendDisconnect(): void;
  abstract sendMessageSentByUser(message: string, isDay: boolean): void;
  abstract sendHandleVote(recipient: number | null, isDay: boolean): void;
  abstract sendHandleVisit(recipient: number | null, isDay: boolean): void;
  abstract sendHandleWhisper(
    recipient: number,
    message: string,
    isDay: boolean,
  ): void;

  abstract onReceiveMessage(listener: (msg: string) => void): void;
  abstract onReceiveChatMessage(listener: (msg: string) => void): void;
  abstract onReceiveWhisperMessage(listener: (msg: string) => void): void;
  abstract onReceivePlayerList(
    listener: (
      playerList: {
        name: string;
        isAlive?: boolean;
        role?: string;
      }[],
    ) => void,
  ): void;
  abstract onReceiveNewPlayer(
    listener: (player: { name: string }) => void,
  ): void;
  abstract onRemovePlayer(listener: (player: { name: string }) => void): void;
  abstract onAssignPlayerRole(
    listener: (player: {
      name: string;
      role: string;
      dayVisitSelf: boolean;
      dayVisitOthers: boolean;
      dayVisitFaction: boolean;
      nightVisitSelf: boolean;
      nightVisitOthers: boolean;
      nightVisitFaction: boolean;
      nightVote: boolean;
    }) => void,
  ): void;
  abstract onUpdateFactionRole(
    listener: (data: { name: string; role: string }) => void,
  ): void;
  abstract onUpdatePlayerRole(
    listener: (data: { name: string; role?: string }) => void,
  ): void;
  abstract onUpdatePlayerVisit(listener: () => void): void;
  abstract onUpdateDayTime(
    listener: (data: {
      time: Time;
      dayNumber: number;
      timeLeft: number;
    }) => void,
  ): void;
  abstract onDisableVoting(listener: () => void): void;
  abstract onBlockMessages(listener: () => void): void;
  abstract close(): void;

  removeAllListeners(): void {
    this.receiveMessageListeners = [];
    this.receiveChatMessageListeners = [];
    this.receiveWhisperMessageListeners = [];
    this.receivePlayerListListeners = [];
    this.receiveNewPlayerListeners = [];
    this.removePlayerListeners = [];
    this.assignPlayerRoleListeners = [];
    this.updateFactionRoleListeners = [];
    this.updatePlayerRoleListeners = [];
    this.updatePlayerVisitListeners = [];
    this.updateDayTimeListeners = [];
    this.disableVotingListeners = [];
    this.blockMessagesListeners = [];
  }
}
