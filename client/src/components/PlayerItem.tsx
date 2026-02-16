import React, { useEffect, useState } from "react";
import { ListGroup, Row, Col, Button, ButtonGroup } from "../ui/bootstrap-shim";

export function PlayerItem({
  index,
  handleVisit,
  handleVote,
  whisperingTo,
  openWhisperMenu,
  dayNumber,
  votingDisabled,
  visiting,
  votingFor,
  canNightVote,
  isUser,
  username,
  role,
  isAlive,
  time,
  canTalk,
  canVisit,
}: {
  index: number;
  handleVisit: (index: number) => void;
  handleVote: (index: number) => void;
  whisperingTo: number | null;
  openWhisperMenu: (playerIndex: number) => void;
  dayNumber: number;
  votingDisabled: boolean;
  visiting: number | null;
  votingFor: number | null;
  canNightVote: boolean;
  isUser: boolean;
  username: string | undefined;
  role: string | undefined;
  isAlive: boolean;
  time: string;
  canTalk: boolean;
  canVisit: boolean[];
}) {
  const [variant, setVariant] = useState("");
  const [canWhisper, setCanWhisper] = useState(false);
  const [canVisitLocal, setCanVisitLocal] = useState(false);

  function canVisitFn() {
    //For now, if the player's role is known, they are interpreted as a member of the same faction
    if (!canTalk || !canVisitLocal) return false;
    if (time === "Day") {
      if (canVisit[0] && isAlive && isUser) return true;
      else if (canVisit[1] && isAlive && role === undefined && !isUser)
        return true;
      else if (canVisit[2] && isAlive && role !== undefined && !isUser)
        return true;
    } else if (time === "Night") {
      if (canVisit[3] && isAlive && isUser) return true;
      else if (canVisit[4] && isAlive && role === undefined && !isUser)
        return true;
      else if (canVisit[5] && isAlive && role !== undefined && !isUser)
        return true;
    }
    return false;
  }

  function canVoteFn() {
    if (
      !votingDisabled &&
      votingFor === null &&
      canTalk &&
      time === "Day" &&
      dayNumber !== 1 &&
      isAlive &&
      !isUser
    )
      return true;
    if (
      time === "Night" &&
      votingFor === null &&
      canNightVote &&
      isAlive &&
      role === undefined &&
      !isUser
    )
      return true;
    return false;
  }

  function canWhisperFn() {
    return (
      canTalk &&
      canWhisper &&
      time === "Day" &&
      dayNumber !== 1 &&
      (whisperingTo === null || whisperingTo === index)
    );
  }

  useEffect(() => {
    if (isAlive) {
      setVariant("primary");
      setCanVisitLocal(true);
      if (isUser) setCanWhisper(false);
      else setCanWhisper(true);
    } else {
      setVariant("danger");
      setCanVisitLocal(false);
      setCanWhisper(false);
    }
  }, [isAlive, isUser]);

  return (
    <ListGroup.Item variant={variant}>
      <Row>
        <Col>
          {username} {role !== undefined ? `(${role})` : ""}
        </Col>
        <Col md="auto">
          <ButtonGroup size="sm">
            {canWhisperFn() && (
              <Button
                variant={whisperingTo === index ? "success" : "primary"}
                onClick={() => openWhisperMenu(index)}
              >
                🗩
              </Button>
            )}
            {canVoteFn() && (
              <Button
                variant={votingFor === index ? "success" : "primary"}
                onClick={() => handleVote(index)}
              >
                ☑
              </Button>
            )}
            {canVisitFn() && (
              <Button
                variant={visiting === index ? "success" : "primary"}
                onClick={() => handleVisit(index)}
              >
                ◎
              </Button>
            )}
          </ButtonGroup>
        </Col>
      </Row>
    </ListGroup.Item>
  );
}
