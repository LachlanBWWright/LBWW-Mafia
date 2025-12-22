import { useState, useEffect, useCallback } from "react";
import { Time } from "~/types/shared";
import type { AbstractSocketClient } from "../socket/AbstractSocketClient";

interface MsgType {
  type: number;
  text: string;
}

interface PlayerType {
  name: string;
  role?: string;
  isUser?: boolean;
  isAlive?: boolean;
}

interface UseGameRoomReturn {
  // State
  canTalk: boolean;
  time: Time;
  dayNumber: number;
  timeLeft: number;
  messages: MsgType[];
  playerList: PlayerType[];
  showScrollDown: boolean;
  scrollNewMessages: number;
  scrollDownRequest: boolean;
  visiting: number | null;
  votingDisabled: boolean;
  votingFor: number | null;
  whisperingTo: number | null;
  canVisit: boolean[];
  canNightVote: boolean;

  // Actions
  handleVisit: (playerIndex: number) => void;
  handleVote: (playerIndex: number) => void;
  handleWhisper: (message: string, whisperingTo: number) => void;
  sendMessage: (message: string) => void;
  joinRoom: (
    captchaToken: string,
    callback: (result: string | number) => void,
  ) => void;
  setWhisperingTo: (playerIndex: number | null) => void;
  setScrollDownRequest: (value: boolean) => void;
  scrollEvent: () => void;
}

export const useGameRoom = (
  scrollRef: React.RefObject<HTMLDivElement | null>,
  setRole: React.Dispatch<React.SetStateAction<string>>,
  socketClient: AbstractSocketClient,
): UseGameRoomReturn => {
  // State
  const [canTalk, setCanTalk] = useState(true);
  const [time, setTime] = useState<Time>(Time.Day);
  const [dayNumber, setDayNumber] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [messages, setMessages] = useState<MsgType[]>([]);
  const [playerList, setPlayerList] = useState<PlayerType[]>([]);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [scrollNewMessages, setScrollNewMessages] = useState(0);
  const [scrollDownRequest, setScrollDownRequest] = useState(false);
  const [visiting, setVisiting] = useState<number | null>(null);
  const [votingDisabled, setVotingDisabled] = useState(false);
  const [votingFor, setVotingFor] = useState<number | null>(null);
  const [whisperingTo, setWhisperingTo] = useState<number | null>(null);
  const [canVisit, setCanVisit] = useState([
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  const [canNightVote, setCanNightVote] = useState(false);

  // Helper function for message scrolling
  const addMessageWithScroll = useCallback((msg: MsgType) => {
    if (scrollRef.current === null) return;

    if (
      scrollRef.current.scrollHeight -
        scrollRef.current.scrollTop -
        scrollRef.current.clientHeight <=
      scrollRef.current.clientHeight / 5
    ) {
      setMessages((messages) => [...messages, msg]);
      setShowScrollDown(false);
      setScrollNewMessages(0);
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else {
      setMessages((messages) => [...messages, msg]);
      setShowScrollDown(true);
      setScrollNewMessages((prev) => prev + 1);
    }
  }, [scrollRef]);

  // Scroll event handler
  const scrollEvent = () => {
    if (
      scrollRef.current !== null &&
      scrollRef.current.scrollHeight -
        scrollRef.current.scrollTop -
        scrollRef.current.clientHeight <=
        scrollRef.current.clientHeight / 5
    ) {
      setShowScrollDown(false);
      setScrollNewMessages(0);
    } else {
      setShowScrollDown(true);
    }
  };

  // Game actions

  const handleVisit = (playerIndex: number) => {
    if (visiting !== playerIndex) {
      setVisiting(playerIndex);
      socketClient.sendHandleVisit(playerIndex, time === Time.Day);
    } else {
      setVisiting(null);
      socketClient.sendHandleVisit(null, time === Time.Day);
    }
  };

  const handleVote = (playerIndex: number) => {
    if (votingFor !== playerIndex) {
      setVotingFor(playerIndex);
      socketClient.sendHandleVote(playerIndex, time === Time.Day);
    } else {
      setVotingFor(null);
      socketClient.sendHandleVote(null, time === Time.Day);
    }
  };

  const handleWhisper = (message: string, whisperingToIndex: number) => {
    if (message.length > 0 && message.length <= 150) {
      socketClient.sendHandleWhisper(
        whisperingToIndex,
        message,
        time === Time.Day,
      );
    }
  };

  const sendMessage = (message: string) => {
    if (message.length > 0 && message.length <= 150) {
      socketClient.sendMessageSentByUser(message, time === Time.Day);
    }
  };

  const joinRoom = (
    captchaToken: string,
    callback: (result: string | number) => void,
  ) => {
    socketClient.sendPlayerJoinRoom(captchaToken, callback);
  };

  // Socket event setup
  useEffect(() => {
    // Register listeners using the abstract client

    socketClient.onReceiveMessage((inMsg) => {
      const msg = { type: 0, text: inMsg };
      addMessageWithScroll(msg);
    });

    socketClient.onReceiveChatMessage((inMsg) => {
      const msg = { type: 1, text: inMsg };
      addMessageWithScroll(msg);
    });

    socketClient.onReceiveWhisperMessage((inMsg) => {
      const msg = { type: 2, text: inMsg };
      addMessageWithScroll(msg);
    });

    socketClient.onReceivePlayerList((listJson) => {
      setPlayerList(listJson);
    });

    socketClient.onReceiveNewPlayer((playerJson) => {
      setPlayerList((prev) => [...prev, playerJson]);
    });

    socketClient.onRemovePlayer((playerJson) => {
      setPlayerList((playerList) => {
        return playerList.filter((player) => player.name !== playerJson.name);
      });
    });

    socketClient.onAssignPlayerRole((playerJson) => {
      setPlayerList((playerList) => {
        const tempPlayerList = [...playerList];
        const index = tempPlayerList.findIndex(
          (player) => player.name === playerJson.name,
        );
        if (tempPlayerList[index] !== undefined) {
          tempPlayerList[index].role = playerJson.role;
          tempPlayerList[index].isUser = true;
        }
        return tempPlayerList;
      });
      setRole(playerJson.role);
      setCanVisit([
        playerJson.dayVisitSelf,
        playerJson.dayVisitOthers,
        playerJson.dayVisitFaction,
        playerJson.nightVisitSelf,
        playerJson.nightVisitOthers,
        playerJson.nightVisitFaction,
      ]);
      setCanNightVote(playerJson.nightVote);
    });

    socketClient.onUpdateFactionRole((playerJson) => {
      setPlayerList((playerList) => {
        const tempPlayerList = [...playerList];
        const index = tempPlayerList.findIndex(
          (player) => player.name === playerJson.name,
        );
        if (
          playerJson.role !== undefined &&
          tempPlayerList[index] !== undefined
        )
          tempPlayerList[index].role = playerJson.role;
        return tempPlayerList;
      });
    });

    socketClient.onUpdatePlayerRole((playerJson) => {
      setPlayerList((playerList) => {
        const tempPlayerList = [...playerList];
        const index = tempPlayerList.findIndex(
          (player) => player.name === playerJson.name,
        );
        if (tempPlayerList[index] !== undefined) {
          if (playerJson.role !== undefined) {
            tempPlayerList[index].role = playerJson.role;
          }
          tempPlayerList[index].isAlive = false;
        }
        return tempPlayerList;
      });
    });

    socketClient.onUpdatePlayerVisit(() => {
      // Updates player to indicate that the player is visiting them
    });

    socketClient.onUpdateDayTime((infoJson) => {
      setTime(infoJson.time as Time);
      setDayNumber(infoJson.dayNumber);
      setVisiting(null);
      setVotingFor(null);
      setWhisperingTo(null);
      let timeLeftLocal = infoJson.timeLeft;
      const countDown = setInterval(() => {
        if (timeLeftLocal > 0) {
          setTimeLeft(timeLeftLocal - 1);
          timeLeftLocal--;
        } else {
          clearInterval(countDown);
        }
      }, 1000);
    });

    socketClient.onDisableVoting(() => {
      setVotingDisabled(true);
    });

    socketClient.onBlockMessages(() => {
      setCanTalk(false);
    });
  }, [setRole, scrollRef, socketClient, addMessageWithScroll]);

  return {
    // State
    canTalk,
    time,
    dayNumber,
    timeLeft,
    messages,
    playerList,
    showScrollDown,
    scrollNewMessages,
    scrollDownRequest,
    visiting,
    votingDisabled,
    votingFor,
    whisperingTo,
    canVisit,
    canNightVote,

    // Actions
    handleVisit,
    handleVote,
    handleWhisper,
    sendMessage,
    joinRoom,
    setWhisperingTo,
    setScrollDownRequest,
    scrollEvent,
  };
};
