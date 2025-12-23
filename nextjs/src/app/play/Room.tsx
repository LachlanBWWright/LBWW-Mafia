import { useEffect, useRef, useState } from "react";
import { Time } from "~/types/shared";
import { Form, Button, ListGroup } from "react-bootstrap";
import { PlayerItem } from "../../components/PlayerItem";
import type { AbstractSocketClient } from "../../socket/AbstractSocketClient";

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

export function Room({
  captchaToken,
  setFailReason,
  setName,
  setRoom,
  setRole,
  socketClient,
}: {
  captchaToken: string;
  setFailReason: React.Dispatch<React.SetStateAction<string>>;
  setName: React.Dispatch<React.SetStateAction<string>>;
  setRoom: React.Dispatch<React.SetStateAction<boolean>>;
  setRole: React.Dispatch<React.SetStateAction<string>>;
  socketClient: AbstractSocketClient;
}) {
  const [textMessage, setTextMessage] = useState("");
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLInputElement>(null);

  function changeText(event: string) {
    setTextMessage(event);
  }

  function handleVisit(playerIndex: number) {
    if (visiting !== playerIndex) {
      setVisiting(playerIndex);
      socketClient.sendHandleVisit(playerIndex, time === Time.Day);
    } else {
      setVisiting(null);
      socketClient.sendHandleVisit(null, time === Time.Day);
    }
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
      socketClient.sendHandleWhisper(
        whisperingTo,
        textMessage,
        time === Time.Day,
      );
    }
    setTextMessage("");
    setWhisperingTo(null);

    if (whisperingTo !== null) openWhisperMenu(whisperingTo);
  }

  function handleVote(playerIndex: number) {
    if (votingFor !== playerIndex) {
      setVotingFor(playerIndex);
      socketClient.sendHandleVote(playerIndex, time === Time.Day);
    } else {
      setVotingFor(null);
      socketClient.sendHandleVote(null, time === Time.Day);
    }
  }

  function sendMessage() {
    if (textMessage.length > 0 && textMessage.length <= 150) {
      socketClient.sendMessageSentByUser(textMessage, time === Time.Day);
      setTextMessage("");
    }
  }

  function scrollEvent() {
    if (
      scrollRef.current !== null &&
      scrollRef.current.scrollHeight -
        scrollRef.current.scrollTop -
        scrollRef.current.clientHeight <=
        scrollRef.current.clientHeight / 5
    ) {
      setShowScrollDown(false);
      setScrollNewMessages(0);
    } else setShowScrollDown(true);
  }

  useEffect(() => {
    const scrollElement = scrollRef.current;
    scrollElement?.addEventListener("scroll", scrollEvent);

    // Register listeners using the abstract client
    socketClient.onReceiveMessage((inMsg) => {
      const msg = { type: 0, text: inMsg };
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
    });

    socketClient.onReceiveChatMessage((inMsg) => {
      const msg = { type: 1, text: inMsg };
      if (!scrollRef.current) return;
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
    });

    socketClient.onReceiveWhisperMessage((inMsg) => {
      const msg = { type: 2, text: inMsg };
      if (!scrollRef.current) return;
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
      // Avoid calling parent state setters inside the updater function — call them here instead
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
      // Implement as needed
    });

    socketClient.onUpdateDayTime((infoJson) => {
      setTime(infoJson.time);
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

    // Join room
    socketClient.sendPlayerJoinRoom(captchaToken, (callback) => {
      if (typeof callback == "number") {
        if (callback === 1)
          setFailReason("Your socket ID was equal to existing player in room.");
        else if (callback === 2)
          setFailReason(
            "Your selected username was the same as another player in the room.",
          );
        else if (callback === 3) setFailReason("The room was full.");
        setName("");
        setRole("");
      } else {
        setFailReason("");
        setName(callback);
      }
    });

    return () => {
      scrollElement?.removeEventListener("scroll", scrollEvent);
      socketClient.removeAllListeners();
      socketClient.sendDisconnect();
    };
  }, [captchaToken, setFailReason, setName, setRole, socketClient]);

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
          {playerList.map((player, index) => (
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
          {messages.map((msg, index) => {
            //Msg Types - 0: Bold, black,
            if (msg.type === 0)
              return (
                <p key={index} style={{ fontWeight: "bold" }}>
                  {msg.text}
                </p>
              );
            //0 - Bold message - Announcement
            else if (msg.type === 1) return <p key={index}>{msg.text}</p>;
            // 1 - Normal Message (No effects)
            else if (msg.type === 2)
              return (
                <p key={index} style={{ fontStyle: "italic" }}>
                  {msg.text}
                </p>
              );
            // 2 - Whisper Message (Italics)
            else return <p key={index}>{msg.text}</p>; // Fallback Message (No effects)
          })}
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
                  placeholder={"Whisper to " + playerList[whisperingTo]?.name}
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
