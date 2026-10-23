import React, { useEffect, useRef, useState } from "react";
import { Form, Button, ListGroup } from "../ui/bootstrap-shim";
import { PlayerItem } from "./PlayerItem";
import { socket } from "../socket/socket";
import {
  ClientEvent,
  DayTime,
  JoinRoomResultCode,
} from "@mernmafia/shared/communication/events";

type MsgType = {
  type: number;
  text: string;
};

type PlayerType = {
  name: string;
  role?: string;
  isUser?: boolean;
  isAlive?: boolean;
};

export function Room({
  captchaToken,
  setFailReason,
  setName,
  setRoom,
  setRole,
}: {
  captchaToken: string;
  setFailReason: React.Dispatch<React.SetStateAction<string>>;
  setName: React.Dispatch<React.SetStateAction<string>>;
  setRoom: React.Dispatch<React.SetStateAction<boolean>>;
  setRole: React.Dispatch<React.SetStateAction<string>>;
}) {
  const [textMessage, setTextMessage] = useState("");
  const [canTalk, setCanTalk] = useState(true);
  const [time, setTime] = useState(DayTime.Day);
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLInputElement>(null);

  function toDisplayMessage(input: unknown) {
    if (typeof input === "string") return input;
    if (!input || typeof input !== "object") return "";
    const maybeMessage = input as { key?: unknown; params?: unknown };
    if (typeof maybeMessage.key !== "string") return "";
    if (!maybeMessage.params || typeof maybeMessage.params !== "object") {
      return maybeMessage.key;
    }
    const params = Object.entries(maybeMessage.params)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(", ");
    return params.length > 0
      ? `${maybeMessage.key} (${params})`
      : maybeMessage.key;
  }

  function changeText(event: string) {
    setTextMessage(event);
  }

  function handleVisit(playerIndex: number) {
    if (visiting !== playerIndex) {
      setVisiting(playerIndex);
      socket.emit(ClientEvent.HandleVisit, playerIndex, time);
    } else {
      setVisiting(null);
      socket.emit(ClientEvent.HandleVisit, null, time);
    }
  }

  function isNearBottom(container: HTMLDivElement) {
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <=
      container.clientHeight / 5
    );
  }

  function appendIncomingMessage(msg: MsgType) {
    const container = scrollRef.current;
    if (!container) return;

    setMessages((current) => [...current, msg]);
    if (!isNearBottom(container)) {
      setShowScrollDown(true);
      setScrollNewMessages((count) => count + 1);
      return;
    }

    setShowScrollDown(false);
    setScrollNewMessages(0);
    container.scrollTop = container.scrollHeight;
  }

  function openWhisperMenu(playerIndex: number) {
    if (whisperingTo === playerIndex) {
      setWhisperingTo(null);
      chatRef.current?.focus(); //TODO: Fix focusing
    } else {
      setWhisperingTo(playerIndex);
      chatRef.current?.focus();
    }
  }

  function handleWhisper() {
    if (
      textMessage.length > 0 &&
      textMessage.length <= 150 &&
      whisperingTo !== null
    ) {
      socket.emit(ClientEvent.HandleWhisper, whisperingTo, textMessage, time);
    }
    setTextMessage("");
    setWhisperingTo(null);

    if (whisperingTo !== null) openWhisperMenu(whisperingTo);
  }

  function handleVote(playerIndex: number) {
    if (votingFor === playerIndex) return;
    setVotingFor(playerIndex);
    socket.emit(ClientEvent.HandleVote, playerIndex, time);
  }

  function sendMessage() {
    if (textMessage.length > 0 && textMessage.length <= 150) {
      socket.emit(ClientEvent.MessageSentByUser, textMessage, time);
      setTextMessage("");
    }
  }

  function renderMessage(msg: MsgType, index: number) {
    switch (msg.type) {
      case 0:
        return (
          <p key={index} style={{ fontWeight: "bold" }}>
            {msg.text}
          </p>
        );
      case 1:
        return <p key={index}>{msg.text}</p>;
      case 2:
        return (
          <p key={index} style={{ fontStyle: "italic" }}>
            {msg.text}
          </p>
        );
      default:
        return <p key={index}>{msg.text}</p>;
    }
  }

  function scrollEvent() {
    if (!scrollRef.current) return;
    const isNear = scrollRef.current.scrollHeight -
      scrollRef.current.scrollTop -
      scrollRef.current.clientHeight <=
      scrollRef.current.clientHeight / 5;
    if (isNear) {
      setShowScrollDown(false);
      setScrollNewMessages(0);
    } else {
      setShowScrollDown(true);
    }
  }

  useEffect(() => {
    scrollRef.current?.addEventListener("scroll", scrollEvent);

    socket.on("connect", () => {
      console.log("You connected to the socket with ID " + socket.id);
    });

    socket.on("receiveMessage", (inMsg: unknown) => {
      appendIncomingMessage({ type: 0, text: toDisplayMessage(inMsg) });
    });

    socket.on("receive-chat-message", (inMsg: string) => {
      appendIncomingMessage({ type: 1, text: inMsg });
    });

    socket.on("receive-whisper-message", (inMsg: string) => {
      appendIncomingMessage({ type: 2, text: inMsg });
    });

    socket.on("receive-player-list", (listJson: PlayerType[]) => {
      //Receive all players upon joining, and the game starting
      setPlayerList(listJson);
    });

    socket.on("receive-new-player", (playerJson: PlayerType) => {
      //Called when a new player joins the lobby
      setPlayerList((current) => [...current, playerJson]);
    });

    socket.on("remove-player", (playerJson: PlayerType) => {
      //Called when a player leaves the lobby before the game starts
      console.log("Removing player " + playerJson.name);
      setPlayerList((playerList) => {
        return playerList.filter((player) => player.name !== playerJson.name);
      });
    });

    socket.on(
      "assign-player-role",
      (
        playerJson: PlayerType & {
          dayVisitSelf: boolean;
          dayVisitOthers: boolean;
          dayVisitFaction: boolean;
          nightVisitSelf: boolean;
          nightVisitOthers: boolean;
          nightVisitFaction: boolean;
          nightVote: boolean;
        },
      ) => {
        //Shows the player their own role, lets the client know that this is who they are playing as

        setPlayerList((playerList) => {
          let tempPlayerList = [...playerList];
          let index = tempPlayerList.findIndex(
            (player) => player.name === playerJson.name,
          );
          tempPlayerList[index].role = playerJson.role;
          tempPlayerList[index].isUser = true;
          setRole(playerJson.role ?? "");

          return tempPlayerList;
        });

        setCanVisit([
          playerJson.dayVisitSelf,
          playerJson.dayVisitOthers,
          playerJson.dayVisitFaction,
          playerJson.nightVisitSelf,
          playerJson.nightVisitOthers,
          playerJson.nightVisitFaction,
        ]);
        setCanNightVote(playerJson.nightVote);
      },
    );

    socket.on("update-faction-role", (playerJson: PlayerType) => {
      //Reveals the role of factional allies
      setPlayerList((playerList) => {
        let tempPlayerList = [...playerList];
        let index = tempPlayerList.findIndex(
          (player) => player.name === playerJson.name,
        );
        if (playerJson.role !== undefined)
          tempPlayerList[index].role = playerJson.role;
        return tempPlayerList;
      });
    });

    socket.on("update-player-role", (playerJson: PlayerType) => {
      //Updates player role upon their death
      setPlayerList((playerList) => {
        let tempPlayerList = [...playerList];
        let index = tempPlayerList.findIndex(
          (player) => player.name === playerJson.name,
        );
        if (playerJson.role !== undefined)
          tempPlayerList[index].role = playerJson.role;
        tempPlayerList[index].isAlive = false;
        return tempPlayerList;
      });
    });

    socket.on("update-player-visit", () => {
      //Updates player to indicate that the player is visiting them
      //JSON contains player name
      //Get player by name, update properties, update JSON
    });

    socket.on(
      "update-day-time",
        (infoJson: { time: DayTime; dayNumber: number; timeLeft: number }) => {
        //Gets whether it is day or night, and how long there is left in the session
        setTime(infoJson.time);
        setDayNumber(infoJson.dayNumber);
        setVisiting(null); //Resets who the player is visiting
        setVotingFor(null);
        setWhisperingTo(null);

        let timeLeftLocal = infoJson.timeLeft;
        let countDown = setInterval(() => {
          if (timeLeftLocal > 0) {
            setTimeLeft(timeLeftLocal - 1);
            timeLeftLocal--;
          } else {
            clearInterval(countDown);
          }
        }, 1000);
      },
    );

    socket.on("disable-voting", () => {
      setVotingDisabled(true);
    });

    socket.on("blockMessages", () => {
      setCanTalk(false);
    });

    socket.emit(ClientEvent.PlayerJoinRoom, captchaToken, (result) => {
      console.log("CALLBACK:", result);
      if (result.status === "rejected") {
        if (result.code === JoinRoomResultCode.GenericError) {
          setFailReason("Unable to join the room.");
        } else if (result.code === JoinRoomResultCode.CaptchaFailed) {
          setFailReason("Captcha verification failed.");
        } else if (result.code === JoinRoomResultCode.RoomFull) {
          setFailReason("The room was full.");
        }
        setRoom(false);
        setName("");
        setRole("");
        return;
      }
      setFailReason("");
      setName(result.username);
    });

    return () => {
      scrollRef.current?.removeEventListener("scroll", scrollEvent);

      socket.off("receiveMessage");
      socket.off("receive-chat-message");
      socket.off("receive-whisper-message");
      socket.off("blockMessages");
      socket.off("receive-role");
      socket.off("receive-player-list");
      socket.off("receive-new-player");
      socket.off("remove-player");
      socket.off("update-player-role");
      socket.off("update-player-visit");
      socket.off("update-day-time");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (scrollDownRequest) {
      setScrollDownRequest(false);
      if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scrollDownRequest]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flex: 1,
        columnGap: "2vh",
        overflow: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maxHeight: "75vh",
        }}
      >
        {dayNumber !== 0 ? (
          <p>
            {time} number {dayNumber}. Seconds remaining: {timeLeft}
          </p>
        ) : (
          <p>Players in room: {playerList.length}</p>
        )}
        <ListGroup style={{ flex: 1 }}>
          {playerList &&
            playerList.map((player, index) => (
              <PlayerItem
                key={player.name}
                index={index}
                handleVisit={handleVisit}
                handleVote={handleVote}
                whisperingTo={whisperingTo}
                openWhisperMenu={openWhisperMenu}
                dayNumber={dayNumber}
                votingDisabled={votingDisabled}
                visiting={visiting}
                votingFor={votingFor}
                canNightVote={canNightVote}
                isUser={player.isUser ?? false}
                username={player.name}
                role={player.role}
                isAlive={player.isAlive ?? true}
                time={time}
                canTalk={canTalk}
                canVisit={canVisit}
              />
            ))}
        </ListGroup>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "auto",
        }}
      >
        <div
          ref={scrollRef}
          style={{
            /* display: 'flex', flexDirection: 'column',  */ flex: 1,
            minHeight: 0,
            overflow: "auto",
          }}
        >
          {messages &&
            messages.map((msg, index) => renderMessage(msg, index))}
          {showScrollDown && scrollNewMessages !== 0 && (
            <Button
              variant="secondary"
              style={{
                position: "sticky",
                bottom: 0,
                left: "50%",
                right: "50%",
                opacity: 0.3,
                visibility: "visible",
              }}
              onClick={() => setScrollDownRequest(true)}
            >
              {scrollNewMessages === 1
                ? "1 New Message"
                : scrollNewMessages + " New Messages"}
            </Button>
          )}
        </div>

        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (whisperingTo !== null) handleWhisper();
            else sendMessage();
          }}
        >
          {canTalk ? (
            whisperingTo !== null ? (
              <div style={{ display: "flex", flexDirection: "row" }}>
                <Form.Control
                  ref={chatRef}
                  placeholder={"Whisper to " + playerList[whisperingTo].name}
                  value={textMessage}
                  onChange={(e) => changeText(e.target.value)}
                  maxLength={150}
                />
                <Button
                  variant="info"
                  onClick={handleWhisper}
                  className="btn-block"
                  style={{ flex: 1 }}
                >
                  Whisper
                </Button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "row" }}>
                <Form.Control
                  ref={chatRef}
                  value={textMessage}
                  onChange={(e) => changeText(e.target.value)}
                  maxLength={150}
                />
                <Button
                  variant="danger"
                  onClick={sendMessage}
                  className="btn-block"
                  style={{ flex: 1 }}
                >
                  Submit
                </Button>
              </div>
            )
          ) : (
            <Button
              variant="danger"
              onClick={() => {
                setRoom(false);
                setName("");
                setRole("");
                setFailReason("");
              }}
              className="btn-block"
            >
              Disconnect
            </Button>
          )}
        </Form>
      </div>
    </div>
  );
}
